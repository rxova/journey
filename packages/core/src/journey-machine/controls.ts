import {
  assertSerializableContext,
  buildInitialAsyncState,
  buildSnapshot,
  cloneContext,
  now,
  warnInDevelopment
} from "./helpers";

import type { JourneyBaseEvent, JourneyJsonObject, JourneySnapshot } from "../types";
import type { JourneyMachineAsyncStateController } from "./async-state";
import type { JourneyMachineRuntime } from "./runtime";

/**
 * Result of {@link JourneyMachineControls.startJourney}. `started` is `true` only
 * when the call performed the `idled → running` transition, letting the caller
 * trigger initial-step effects/timers exactly once (and never on a no-op start).
 */
export type JourneyStartResult<TContext extends JourneyJsonObject, TStepId extends string> = {
  snapshot: JourneySnapshot<TContext, TStepId>;
  started: boolean;
};

export type JourneyMachineControls<TContext extends JourneyJsonObject, TStepId extends string> = {
  startJourney: () => Promise<JourneyStartResult<TContext, TStepId>>;
  resetJourney: () => Promise<JourneySnapshot<TContext, TStepId>>;
  updateContext: (
    updater: (context: TContext) => TContext
  ) => Promise<JourneySnapshot<TContext, TStepId>>;
  clearStepError: (stepId?: TStepId) => Promise<JourneySnapshot<TContext, TStepId>>;
  dispose: () => void;
};

export const createJourneyMachineControls = <
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEvents extends JourneyBaseEvent
>({
  runtime,
  asyncState,
  initial,
  initialContext,
  steps
}: {
  runtime: JourneyMachineRuntime<TContext, TStepId, TEvents>;
  asyncState: JourneyMachineAsyncStateController<TStepId>;
  initial: TStepId;
  initialContext: TContext;
  steps: Record<TStepId, unknown>;
}): JourneyMachineControls<TContext, TStepId> => {
  const warnDisposedNoop = (operation: string) => {
    warnInDevelopment(`Journey machine has been disposed; "${operation}" is a no-op.`);
  };

  // Snapshot the initial context once at machine creation so later mutations
  // to the caller-owned reference cannot leak into subsequent resets.
  const initialContextSnapshot = cloneContext(initialContext);

  const buildResetSnapshot = () =>
    buildSnapshot(
      [initial],
      0,
      cloneContext(initialContextSnapshot),
      "idled",
      buildInitialAsyncState(steps)
    );

  return {
    startJourney: () => {
      if (runtime.isDisposed()) {
        warnDisposedNoop("startJourney");
        return Promise.resolve({ snapshot: runtime.getSnapshot(), started: false });
      }

      return runtime.queue(
        async () => {
          const snapshot = runtime.peekSnapshot();
          if (snapshot.status !== "idled") {
            return { snapshot: runtime.getSnapshot(), started: false };
          }

          const committedSnapshot = runtime.setSnapshot(
            {
              ...snapshot,
              status: "running"
            },
            { notify: true, reason: "start" }
          );
          runtime.emit({
            type: "journey.start",
            stepId: committedSnapshot.currentStepId,
            timestamp: now()
          });
          return { snapshot: runtime.getSnapshot(), started: true };
        },
        () => ({ snapshot: runtime.getSnapshot(), started: false })
      );
    },
    resetJourney: () => {
      if (runtime.isDisposed()) {
        warnDisposedNoop("resetJourney");
        return Promise.resolve(runtime.getSnapshot());
      }

      runtime.cancelInFlight();
      return runtime.queue(
        async () => {
          const committedSnapshot = runtime.setSnapshot(buildResetSnapshot(), {
            notify: true,
            reason: "reset"
          });
          runtime.emit({
            type: "journey.reset",
            stepId: committedSnapshot.currentStepId,
            timestamp: now()
          });
          asyncState.syncState(committedSnapshot.async);
          return runtime.getSnapshot();
        },
        () => runtime.getSnapshot()
      );
    },
    updateContext: (updater) => {
      if (runtime.isDisposed()) {
        warnDisposedNoop("updateContext");
        return Promise.resolve(runtime.getSnapshot());
      }

      return runtime.queue(
        async () => {
          const snapshot = runtime.peekSnapshot();
          const nextContext = assertSerializableContext(updater(cloneContext(snapshot.context)));
          const committedSnapshot = runtime.setSnapshot(
            {
              ...snapshot,
              context: nextContext
            },
            { notify: true, reason: "context" }
          );
          return committedSnapshot;
        },
        () => runtime.getSnapshot()
      );
    },
    clearStepError: (stepId?: TStepId) => {
      if (runtime.isDisposed()) {
        warnDisposedNoop("clearStepError");
        return Promise.resolve(runtime.getSnapshot());
      }

      return runtime.queue(
        async () => {
          const snapshot = runtime.peekSnapshot();
          const resolvedStep = stepId ?? snapshot.currentStepId;
          if (!(resolvedStep in steps)) {
            return runtime.getSnapshot();
          }

          asyncState.setStepIdle(resolvedStep);
          return runtime.getSnapshot();
        },
        () => runtime.getSnapshot()
      );
    },
    dispose: () => {
      runtime.dispose();
    }
  };
};
