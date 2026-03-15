import {
  assertStepExists,
  buildSendResult,
  isGoToStepByIdEvent,
  isPromiseLike,
  isTerminalTarget,
  JourneyTimeoutError,
  now,
  resolveTransitionTarget,
  selectTransition,
  withTimeout
} from "../machine-helpers";

import type {
  JourneyEvent,
  JourneyEventPayloadMap,
  JourneySendEvent,
  JourneySendResult,
  JourneyTransition,
  JourneyTransitionArgs
} from "../types";
import type { MachineAsyncStateController } from "./async-state";
import type { MachineNavigationController } from "./navigation";
import type { MachineRuntime } from "./runtime";

// Module-scope aliases keep the per-call-site generics readable.
type RuntimeSendEvent<
  TStepId extends string,
  TEventType extends string,
  TPayloadMap extends JourneyEventPayloadMap<TEventType>
> = JourneySendEvent<TStepId, TEventType, TPayloadMap>;

type RuntimeTransitionEvent<
  TStepId extends string,
  TEventType extends string,
  TPayloadMap extends JourneyEventPayloadMap<TEventType>
> = JourneyEvent<TStepId, TEventType, TPayloadMap>;

type RuntimeTransition<
  TContext,
  TStepId extends string,
  TEventType extends string,
  TPayloadMap extends JourneyEventPayloadMap<TEventType>
> = JourneyTransition<TContext, TStepId, TEventType, TPayloadMap>;

export type MachineSendController<
  TContext,
  TStepId extends string,
  TEventType extends string,
  TPayloadMap extends JourneyEventPayloadMap<TEventType>,
  TStepMeta
> = {
  executeSend: (
    event: JourneySendEvent<TStepId, TEventType, TPayloadMap>,
    runVersion: number
  ) => Promise<JourneySendResult<TContext, TStepId, TStepMeta>>;
  buildCanceledSendResult: () => JourneySendResult<TContext, TStepId, TStepMeta>;
};

export const createMachineSendController = <
  TContext,
  TStepId extends string,
  TEventType extends string,
  TPayloadMap extends JourneyEventPayloadMap<TEventType>,
  TStepMeta
>({
  runtime,
  asyncState,
  navigation,
  steps,
  transitions,
  completeOnNoNextStep
}: {
  runtime: MachineRuntime<TContext, TStepId, TEventType, TPayloadMap, TStepMeta>;
  asyncState: MachineAsyncStateController<TStepId>;
  navigation: MachineNavigationController<TContext, TStepId, TEventType, TPayloadMap, TStepMeta>;
  steps: Record<TStepId, unknown>;
  transitions: readonly JourneyTransition<TContext, TStepId, TEventType, TPayloadMap>[];
  completeOnNoNextStep: boolean;
}): MachineSendController<TContext, TStepId, TEventType, TPayloadMap, TStepMeta> => {
  const buildCanceledSendResult = (): JourneySendResult<TContext, TStepId, TStepMeta> =>
    buildSendResult(runtime.getSnapshot(), false);

  const buildErroredSendResult = (
    error: unknown,
    transitionId?: string
  ): JourneySendResult<TContext, TStepId, TStepMeta> =>
    buildSendResult(runtime.getSnapshot(), false, {
      ...(transitionId !== undefined ? { transitionId } : {}),
      error
    });

  const buildTransitionErrorResult = (
    fromStep: TStepId,
    eventType: string,
    error: unknown,
    transitionId: string | null,
    runVersion: number
  ): JourneySendResult<TContext, TStepId, TStepMeta> => {
    asyncState.setStepError(fromStep, eventType, error, transitionId ?? undefined, runVersion);
    runtime.emit({
      type: "transition.error",
      from: fromStep,
      eventType,
      transitionId,
      error,
      timestamp: now()
    });
    return buildErroredSendResult(error, transitionId ?? undefined);
  };

  const resolveTransitionsForSend = (
    event: RuntimeSendEvent<TStepId, TEventType, TPayloadMap>,
    fromStep: TStepId,
    runVersion: number
  ): {
    transitionsToEvaluate: readonly RuntimeTransition<TContext, TStepId, TEventType, TPayloadMap>[];
    earlyResult: JourneySendResult<TContext, TStepId, TStepMeta> | null;
  } => {
    if (!isGoToStepByIdEvent(event)) {
      return { transitionsToEvaluate: transitions, earlyResult: null };
    }

    assertStepExists(steps, event.stepId, `Cannot goToStepById unknown step "${event.stepId}".`);

    const goToStepTransitions = transitions.filter((transition) => {
      const fromMatches = transition.from === "*" || transition.from === fromStep;
      return (
        fromMatches &&
        transition.event === "goToStepById" &&
        "to" in transition &&
        transition.to === event.stepId
      );
    });

    if (goToStepTransitions.length === 0) {
      return {
        transitionsToEvaluate: transitions,
        earlyResult: navigation.applyDirectGoToStepById(event.stepId, fromStep, runVersion)
      };
    }

    return { transitionsToEvaluate: goToStepTransitions, earlyResult: null };
  };

  const selectTransitionForSend = async (
    transitionsToEvaluate: readonly RuntimeTransition<TContext, TStepId, TEventType, TPayloadMap>[],
    transitionEvent: RuntimeTransitionEvent<TStepId, TEventType, TPayloadMap>,
    fromStep: TStepId,
    runVersion: number
  ): Promise<
    | {
        transition: RuntimeTransition<TContext, TStepId, TEventType, TPayloadMap> | null;
        earlyResult: null;
      }
    | { transition: null; earlyResult: JourneySendResult<TContext, TStepId, TStepMeta> }
  > => {
    let transition;
    try {
      transition = await selectTransition(
        transitionsToEvaluate,
        runtime.getSnapshot(),
        transitionEvent,
        {
          onAsyncGuardStart: (currentTransition) => {
            asyncState.setStepLoading(
              fromStep,
              "evaluating-when",
              transitionEvent.type,
              currentTransition.id,
              runVersion
            );
          },
          onAsyncGuardSuccess: () => {
            asyncState.setStepIdle(fromStep, runVersion);
          },
          onAsyncGuardError: (currentTransition, error) => {
            asyncState.setStepError(
              fromStep,
              transitionEvent.type,
              error,
              currentTransition.id,
              runVersion
            );
          }
        }
      );
    } catch (error) {
      if (!runtime.isRunActive(runVersion)) {
        return { transition: null, earlyResult: buildCanceledSendResult() };
      }

      return {
        transition: null,
        earlyResult: buildTransitionErrorResult(
          fromStep,
          transitionEvent.type,
          error,
          null,
          runVersion
        )
      };
    }

    return { transition, earlyResult: null };
  };

  const handleNoTransitionMatch = (
    event: RuntimeSendEvent<TStepId, TEventType, TPayloadMap>,
    fromStep: TStepId
  ): JourneySendResult<TContext, TStepId, TStepMeta> => {
    if (isGoToStepByIdEvent(event)) {
      return buildCanceledSendResult();
    }

    if (event.type === "goToPreviousStep" || event.type === "back") {
      const fallbackResult = navigation.applyPreviousNavigation(1, event.type);
      if (fallbackResult.transitioned) {
        runtime.emit({
          type: "transition.success",
          from: fromStep,
          to: fallbackResult.snapshot.currentStepId,
          eventType: event.type,
          transitionId: null,
          timestamp: now()
        });
      }
      return fallbackResult;
    }

    if (
      event.type === "goToNextStep" &&
      completeOnNoNextStep &&
      !navigation.hasDeclaredTransitionForEvent(fromStep, "goToNextStep")
    ) {
      return navigation.commitTerminalTransition(
        fromStep,
        "COMPLETE",
        event,
        null,
        runtime.getSnapshot().context
      );
    }

    return buildCanceledSendResult();
  };

  const resolveNextContext = async (
    transition: RuntimeTransition<TContext, TStepId, TEventType, TPayloadMap>,
    transitionEvent: RuntimeTransitionEvent<TStepId, TEventType, TPayloadMap>,
    fromStep: TStepId,
    runVersion: number
  ): Promise<
    | { nextContext: TContext; earlyResult: null }
    | { nextContext: null; earlyResult: JourneySendResult<TContext, TStepId, TStepMeta> }
  > => {
    const snapshot = runtime.getSnapshot();
    let nextContext = snapshot.context;
    if (!transition.effect) {
      return { nextContext, earlyResult: null };
    }

    let effectResultPromise: TContext | void | Promise<TContext | void>;
    try {
      effectResultPromise = (
        transition.effect as (
          args: JourneyTransitionArgs<TContext, TStepId, TEventType, TPayloadMap>
        ) => TContext | void | Promise<TContext | void>
      )({
        context: snapshot.context,
        from: snapshot.currentStepId,
        timeline: snapshot.history.timeline,
        index: snapshot.history.index,
        event: transitionEvent
      });
    } catch (error) {
      if (!runtime.isRunActive(runVersion)) {
        return { nextContext: null, earlyResult: buildCanceledSendResult() };
      }

      return {
        nextContext: null,
        earlyResult: buildTransitionErrorResult(
          fromStep,
          transitionEvent.type,
          error,
          transition.id ?? null,
          runVersion
        )
      };
    }

    const asyncEffect = isPromiseLike(effectResultPromise);
    if (asyncEffect) {
      asyncState.setStepLoading(
        fromStep,
        "running-effect",
        transitionEvent.type,
        transition.id,
        runVersion
      );

      const timeoutMs = transition.timeoutMs;
      effectResultPromise = withTimeout(
        effectResultPromise as PromiseLike<TContext | void>,
        timeoutMs,
        () =>
          new JourneyTimeoutError(
            `Transition effect timed out after ${timeoutMs}ms (event: ${transitionEvent.type}, transition: ${transition.id ?? "<anonymous>"}).`
          )
      );
    }

    let effectResult: TContext | void;
    try {
      effectResult = await effectResultPromise;
    } catch (error) {
      if (!runtime.isRunActive(runVersion)) {
        return { nextContext: null, earlyResult: buildCanceledSendResult() };
      }

      return {
        nextContext: null,
        earlyResult: buildTransitionErrorResult(
          fromStep,
          transitionEvent.type,
          error,
          transition.id ?? null,
          runVersion
        )
      };
    }

    if (!runtime.isRunActive(runVersion)) {
      return { nextContext: null, earlyResult: buildCanceledSendResult() };
    }

    if (effectResult !== undefined) {
      nextContext = effectResult;
    }

    return { nextContext, earlyResult: null };
  };

  return {
    buildCanceledSendResult,
    executeSend: async (
      event: RuntimeSendEvent<TStepId, TEventType, TPayloadMap>,
      runVersion: number
    ): Promise<JourneySendResult<TContext, TStepId, TStepMeta>> => {
      if (runtime.getSnapshot().status !== "running") {
        return buildCanceledSendResult();
      }

      const fromStep = runtime.getSnapshot().currentStepId;
      const transitionEvent = event as RuntimeTransitionEvent<TStepId, TEventType, TPayloadMap>;
      runtime.emit({ type: "transition.start", from: fromStep, event, timestamp: now() });

      const transitionResolution = resolveTransitionsForSend(event, fromStep, runVersion);
      if (transitionResolution.earlyResult) {
        return transitionResolution.earlyResult;
      }

      const selectionResolution = await selectTransitionForSend(
        transitionResolution.transitionsToEvaluate,
        transitionEvent,
        fromStep,
        runVersion
      );
      if (selectionResolution.earlyResult) {
        return selectionResolution.earlyResult;
      }

      if (!runtime.isRunActive(runVersion)) {
        return buildCanceledSendResult();
      }

      const { transition } = selectionResolution;
      if (!transition) {
        return handleNoTransitionMatch(event, fromStep);
      }

      const contextResolution = await resolveNextContext(
        transition,
        transitionEvent,
        fromStep,
        runVersion
      );
      if (contextResolution.earlyResult) {
        return contextResolution.earlyResult;
      }

      asyncState.setStepIdle(fromStep, runVersion);

      const target = resolveTransitionTarget(transition);
      if (isTerminalTarget(target)) {
        return navigation.commitTerminalTransition(
          fromStep,
          target,
          transitionEvent,
          transition.id ?? null,
          contextResolution.nextContext
        );
      }

      return navigation.commitStepTransition(
        fromStep,
        target,
        transitionEvent,
        transition,
        contextResolution.nextContext
      );
    }
  };
};
