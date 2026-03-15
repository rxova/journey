import { buildIdleStepAsyncState } from "../machine-helpers";

import type { JourneyAsyncPhase, JourneyAsyncState, JourneyEventPayloadMap } from "../types";
import type { MachineRuntime } from "./runtime";

export type MachineAsyncStateController<TStepId extends string> = {
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

export const createMachineAsyncStateController = <
  TContext,
  TStepId extends string,
  TEventType extends string,
  TPayloadMap extends JourneyEventPayloadMap<TEventType>,
  TStepMeta
>({
  runtime
}: {
  runtime: MachineRuntime<TContext, TStepId, TEventType, TPayloadMap, TStepMeta>;
}): MachineAsyncStateController<TStepId> => {
  const isAsyncLoadingPhase = (phase: JourneyAsyncPhase): boolean =>
    phase === "evaluating-when" || phase === "running-effect";

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

    const snapshot = runtime.getSnapshot();
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
    const isLoading = Object.values(nextByStep).some((state) => isAsyncLoadingPhase(state.phase));
    runtime.setSnapshot(
      {
        ...snapshot,
        async: {
          isLoading,
          byStep: nextByStep
        }
      },
      { notify: true }
    );
  };

  return {
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
