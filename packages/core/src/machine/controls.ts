import { buildInitialAsyncState, buildSnapshot, now } from "../machine-helpers";

import type { JourneyEventPayloadMap, JourneySnapshot } from "../types";
import type { MachineAsyncStateController } from "./async-state";
import type { MachineRuntime } from "./runtime";

export type MachineControls<TContext, TStepId extends string, TStepMeta> = {
  resetMachine: () => JourneySnapshot<TContext, TStepId, TStepMeta>;
  updateContext: (
    updater: (context: TContext) => TContext
  ) => JourneySnapshot<TContext, TStepId, TStepMeta>;
  updateStepMetadata: (
    stepId: TStepId,
    updater: (metadata: TStepMeta) => TStepMeta
  ) => JourneySnapshot<TContext, TStepId, TStepMeta>;
  clearStepError: (stepId?: TStepId) => JourneySnapshot<TContext, TStepId, TStepMeta>;
  dispose: () => void;
};

export const createMachineControls = <
  TContext,
  TStepId extends string,
  TEventType extends string,
  TPayloadMap extends JourneyEventPayloadMap<TEventType>,
  TStepMeta
>({
  runtime,
  asyncState,
  initial,
  initialContext,
  steps,
  buildStepMeta,
  clearOnReset
}: {
  runtime: MachineRuntime<TContext, TStepId, TEventType, TPayloadMap, TStepMeta>;
  asyncState: MachineAsyncStateController<TStepId>;
  initial: TStepId;
  initialContext: TContext;
  steps: Record<TStepId, unknown>;
  buildStepMeta: () => Record<TStepId, TStepMeta>;
  clearOnReset: boolean;
}): MachineControls<TContext, TStepId, TStepMeta> => ({
  resetMachine: () => {
    const snapshot = runtime.getSnapshot();
    if (runtime.isDisposed()) {
      return snapshot;
    }

    runtime.cancelInFlight();
    const nextSnapshot = buildSnapshot(
      [initial],
      0,
      initialContext,
      "running",
      buildInitialAsyncState(steps),
      buildStepMeta()
    );
    // Persist or clear before notifying so subscribers observe a state that is
    // already durable (or cleared) when they run.
    runtime.setSnapshot(nextSnapshot, {
      persist: !clearOnReset,
      clearPersisted: clearOnReset,
      notify: true
    });
    return nextSnapshot;
  },
  updateContext: (updater) => {
    const snapshot = runtime.getSnapshot();
    if (runtime.isDisposed()) {
      return snapshot;
    }

    return runtime.setSnapshot(
      {
        ...snapshot,
        context: updater(snapshot.context)
      },
      { persist: true, notify: true }
    );
  },
  updateStepMetadata: (stepId, updater) => {
    const snapshot = runtime.getSnapshot();
    if (runtime.isDisposed()) {
      return snapshot;
    }

    if (!(stepId in steps)) {
      return snapshot;
    }

    const previousMeta = snapshot.stepMeta[stepId];
    const nextMeta = updater(previousMeta);
    if (Object.is(previousMeta, nextMeta)) {
      return snapshot;
    }

    const nextSnapshot = runtime.setSnapshot(
      {
        ...snapshot,
        stepMeta: {
          ...snapshot.stepMeta,
          [stepId]: nextMeta
        }
      },
      { persist: true, notify: true }
    );
    runtime.emit({
      type: "metadata.updated",
      stepId,
      previous: previousMeta,
      next: nextMeta,
      timestamp: now()
    });
    return nextSnapshot;
  },
  clearStepError: (stepId?: TStepId) => {
    const snapshot = runtime.getSnapshot();
    if (runtime.isDisposed()) {
      return snapshot;
    }

    const resolvedStep = stepId ?? snapshot.currentStepId;
    if (!(resolvedStep in steps)) {
      return snapshot;
    }

    asyncState.setStepIdle(resolvedStep);
    return runtime.getSnapshot();
  },
  dispose: () => {
    runtime.dispose();
  }
});
