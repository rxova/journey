import { buildIdleStepAsyncState } from "./helpers";

import type {
  JourneyAsyncPhase,
  JourneyAsyncState,
  JourneyJsonObject,
  JourneyStepAsyncState
} from "../types";
import type { JourneyMachineRuntime } from "./runtime";

export type JourneyMachineAsyncStateController<TStepId extends string> = {
  syncState: (asyncState: JourneyAsyncState<TStepId>) => void;
  updateStepAsync: (
    stepId: TStepId,
    updater: (
      current: JourneyAsyncState<TStepId>["byStep"][TStepId]
    ) => JourneyAsyncState<TStepId>["byStep"][TStepId],
    runVersion?: number
  ) => void;
  setStepLoading: (
    stepId: TStepId,
    phase: JourneyAsyncPhase,
    eventType: string,
    transitionId?: string,
    runVersion?: number
  ) => void;
  setStepIdle: (stepId: TStepId, runVersion?: number) => void;
  setStepError: (
    stepId: TStepId,
    eventType: string,
    error: unknown,
    transitionId?: string,
    runVersion?: number
  ) => void;
};

export const createJourneyMachineAsyncStateController = <
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown>
>({
  runtime
}: {
  runtime: JourneyMachineRuntime<TContext, TStepId, TEventMap>;
}): JourneyMachineAsyncStateController<TStepId> => {
  const isAsyncLoadingPhase = (phase: JourneyAsyncPhase): boolean => phase === "evaluating-when";

  const countLoadingSteps = (asyncState: JourneyAsyncState<TStepId>): number =>
    (Object.values(asyncState.byStep) as JourneyStepAsyncState[]).reduce(
      (count, state) => count + (isAsyncLoadingPhase(state.phase) ? 1 : 0),
      0
    );

  let loadingCount = countLoadingSteps(runtime.peekSnapshot().async);

  const syncState = (asyncState: JourneyAsyncState<TStepId>) => {
    loadingCount = countLoadingSteps(asyncState);
  };

  const updateStepAsync = (
    stepId: TStepId,
    updater: (
      current: JourneyAsyncState<TStepId>["byStep"][TStepId]
    ) => JourneyAsyncState<TStepId>["byStep"][TStepId],
    runVersion?: number
  ) => {
    if (runVersion !== undefined && !runtime.isRunActive(runVersion)) {
      return;
    }

    const snapshot = runtime.peekSnapshot();
    const current = snapshot.async.byStep[stepId] ?? buildIdleStepAsyncState();
    const next = updater(current);
    if (
      current.phase === next.phase &&
      current.eventType === next.eventType &&
      current.transitionId === next.transitionId &&
      current.error === next.error
    ) {
      return;
    }

    const nextByStep = {
      ...snapshot.async.byStep,
      [stepId]: next
    };
    const wasLoading = isAsyncLoadingPhase(current.phase);
    const willBeLoading = isAsyncLoadingPhase(next.phase);
    const nextLoadingCount =
      wasLoading === willBeLoading ? loadingCount : loadingCount + (willBeLoading ? 1 : -1);
    runtime.setSnapshot(
      {
        ...snapshot,
        async: {
          isLoading: nextLoadingCount > 0,
          byStep: nextByStep
        }
      },
      { notify: true, reason: "async" }
    );
    loadingCount = nextLoadingCount;
  };

  return {
    syncState,
    updateStepAsync,
    setStepLoading: (
      stepId: TStepId,
      phase: JourneyAsyncPhase,
      eventType: string,
      transitionId?: string,
      runVersion?: number
    ) => {
      updateStepAsync(
        stepId,
        () => ({
          phase,
          eventType,
          transitionId: transitionId ?? null,
          error: null
        }),
        runVersion
      );
    },
    setStepIdle: (stepId: TStepId, runVersion?: number) => {
      updateStepAsync(stepId, () => buildIdleStepAsyncState(), runVersion);
    },
    setStepError: (
      stepId: TStepId,
      eventType: string,
      error: unknown,
      transitionId?: string,
      runVersion?: number
    ) => {
      updateStepAsync(
        stepId,
        () => ({
          phase: "error",
          eventType,
          transitionId: transitionId ?? null,
          error
        }),
        runVersion
      );
    }
  };
};
