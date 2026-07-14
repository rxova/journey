import {
  assertSerializableContext,
  assertStepExists,
  buildSendResult,
  createCanceledSendResultBuilder,
  isGoToStepByIdEvent,
  isInternalEventType,
  isTerminalTarget,
  now,
  resolveTransitionTarget,
  selectTransition,
  stabilizeSnapshot
} from "./helpers";

import type {
  JourneyBaseEvent,
  JourneyEvent,
  JourneyJsonObject,
  JourneyNoMatchContext,
  JourneyResolvedTransition,
  JourneySendEvent,
  JourneySendResult,
  JourneyTransitionArgsForEvent,
  JourneyTransitionUpdateContextArgsForEvent
} from "../types";
import type { JourneyMachineAsyncStateController } from "./async-state";
import type { JourneyMachineNavigationController } from "./navigation";
import type { JourneyMachineRuntime } from "./runtime";

type RuntimeSendEvent<TStepId extends string, TEvents extends JourneyBaseEvent> = JourneySendEvent<
  TStepId,
  TEvents
>;

type RuntimeTransitionEvent<
  TStepId extends string,
  TEvents extends JourneyBaseEvent
> = JourneyEvent<TStepId, TEvents>;

type RuntimeTransition<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEvents extends JourneyBaseEvent,
  THandlers extends Record<string, unknown>
> = JourneyResolvedTransition<TContext, TStepId, TEvents, THandlers>;

export type JourneyMachineSendController<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEvents extends JourneyBaseEvent
> = {
  executeSend: (
    event: JourneySendEvent<TStepId, TEvents>,
    runVersion: number,
    signal: AbortSignal
  ) => Promise<JourneySendResult<TContext, TStepId>>;
  buildCanceledSendResult: (operation?: string) => JourneySendResult<TContext, TStepId>;
};

export const createJourneyMachineSendController = <
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEvents extends JourneyBaseEvent,
  THandlers extends Record<string, unknown>
>(
  runtime: JourneyMachineRuntime<TContext, TStepId, TEvents>,
  asyncState: JourneyMachineAsyncStateController<TStepId>,
  navigation: JourneyMachineNavigationController<TContext, TStepId, TEvents, THandlers>,
  headless: boolean,
  steps: Record<TStepId, unknown>,
  transitions: readonly JourneyResolvedTransition<TContext, TStepId, TEvents, THandlers>[],
  handlers: THandlers,
  requireExplicitCompletion: boolean,
  defaultTimeoutMs: number | undefined,
  reportNoMatch: (context: JourneyNoMatchContext<TStepId>) => void
): JourneyMachineSendController<TContext, TStepId, TEvents> => {
  const buildCanceledSendResult = createCanceledSendResultBuilder<TContext, TStepId>(runtime);

  // The event reached the runtime but produced no transition. Surface it as a
  // dropped event (skipping internal synthetic effect/after events), then return
  // the canceled no-op result.
  const dropAsNoMatch = (
    event: RuntimeSendEvent<TStepId, TEvents>,
    fromStep: TStepId
  ): JourneySendResult<TContext, TStepId> => {
    if (!isInternalEventType(event.type)) {
      reportNoMatch({ from: fromStep, eventType: event.type });
    }
    return buildCanceledSendResult(event.type);
  };

  const buildErroredSendResult = (
    error: unknown,
    transitionId?: string,
    label?: string
  ): JourneySendResult<TContext, TStepId> =>
    buildSendResult(runtime.getSnapshot(), false, {
      ...(transitionId !== undefined ? { transitionId } : {}),
      ...(label !== undefined ? { label } : {}),
      error
    });

  const buildTransitionErrorResult = (
    fromStep: TStepId,
    eventType: string,
    error: unknown,
    transitionId: string | null,
    label: string | undefined,
    runVersion: number,
    skipAsyncStateUpdate = false
  ): JourneySendResult<TContext, TStepId> => {
    if (!skipAsyncStateUpdate) {
      asyncState.setStepError(fromStep, eventType, error, transitionId ?? undefined, runVersion);
    }
    runtime.emit({
      type: "transition.error",
      from: fromStep,
      eventType,
      transitionId,
      ...(label !== undefined ? { label } : {}),
      error,
      timestamp: now()
    });
    return buildErroredSendResult(error, transitionId ?? undefined, label);
  };

  const resolveTransitionsForSend = (
    event: RuntimeSendEvent<TStepId, TEvents>,
    fromStep: TStepId
  ): {
    transitionsToEvaluate: readonly RuntimeTransition<TContext, TStepId, TEvents, THandlers>[];
    earlyResult: JourneySendResult<TContext, TStepId> | null;
  } => {
    if (!isGoToStepByIdEvent(event)) {
      return { transitionsToEvaluate: transitions, earlyResult: null };
    }

    assertStepExists(steps, event.stepId, `Cannot goToStepById unknown step "${event.stepId}".`);

    return {
      transitionsToEvaluate: transitions.filter((transition) => {
        const fromMatches = transition.from === "*" || transition.from === fromStep;
        return (
          fromMatches &&
          transition.event === "goToStepById" &&
          "to" in transition &&
          transition.to === event.stepId
        );
      }),
      earlyResult: null
    };
  };

  const selectTransitionForSend = async (
    transitionsToEvaluate: readonly RuntimeTransition<TContext, TStepId, TEvents, THandlers>[],
    transitionEvent: RuntimeTransitionEvent<TStepId, TEvents>,
    fromStep: TStepId,
    runVersion: number,
    signal: AbortSignal
  ): Promise<
    | {
        transition: RuntimeTransition<TContext, TStepId, TEvents, THandlers> | null;
        earlyResult: null;
      }
    | { transition: null; earlyResult: JourneySendResult<TContext, TStepId> }
  > => {
    let transition;
    let asyncGuardErrorTransitionId: string | null = null;
    let asyncGuardErrorLabel: string | undefined;
    let asyncGuardErrorHandled = false;
    try {
      transition = (await selectTransition(
        transitionsToEvaluate as unknown as never,
        stabilizeSnapshot(runtime.peekSnapshot()),
        transitionEvent,
        signal,
        handlers,
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
            asyncGuardErrorTransitionId = currentTransition.id ?? null;
            asyncGuardErrorLabel = currentTransition.label;
            asyncGuardErrorHandled = true;
            asyncState.setStepError(
              fromStep,
              transitionEvent.type,
              error,
              currentTransition.id,
              runVersion
            );
          }
        },
        defaultTimeoutMs
      )) as RuntimeTransition<TContext, TStepId, TEvents, THandlers> | null;
    } catch (error) {
      if (!runtime.isRunActive(runVersion)) {
        return { transition: null, earlyResult: buildCanceledSendResult(transitionEvent.type) };
      }

      return {
        transition: null,
        earlyResult: buildTransitionErrorResult(
          fromStep,
          transitionEvent.type,
          error,
          asyncGuardErrorTransitionId,
          asyncGuardErrorLabel,
          runVersion,
          asyncGuardErrorHandled
        )
      };
    }

    return { transition, earlyResult: null };
  };

  const handleNoTransitionMatch = (
    event: RuntimeSendEvent<TStepId, TEvents>,
    fromStep: TStepId,
    runVersion: number
  ): JourneySendResult<TContext, TStepId> => {
    if (isGoToStepByIdEvent(event)) {
      return dropAsNoMatch(event, fromStep);
    }

    if (event.type === "goToPreviousStep") {
      const fallbackResult = navigation.applyPreviousNavigation(1, event.type, runVersion);
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
      !requireExplicitCompletion &&
      !navigation.hasDeclaredTransitionForEvent(fromStep, "goToNextStep")
    ) {
      return navigation.commitTerminalTransition(
        fromStep,
        "COMPLETE",
        event,
        null,
        undefined,
        runtime.peekSnapshot().context,
        runVersion
      );
    }

    if (
      event.type === "completeJourney" &&
      !navigation.hasDeclaredTransitionForEvent(fromStep, "completeJourney")
    ) {
      return navigation.commitTerminalTransition(
        fromStep,
        "COMPLETE",
        event,
        null,
        undefined,
        runtime.peekSnapshot().context,
        runVersion
      );
    }

    if (
      event.type === "terminateJourney" &&
      !navigation.hasDeclaredTransitionForEvent(fromStep, "terminateJourney")
    ) {
      return navigation.commitTerminalTransition(
        fromStep,
        "TERMINATED",
        event,
        null,
        undefined,
        runtime.peekSnapshot().context,
        runVersion
      );
    }

    return dropAsNoMatch(event, fromStep);
  };

  const resolveNextContext = (
    transition: RuntimeTransition<TContext, TStepId, TEvents, THandlers>,
    transitionEvent: RuntimeTransitionEvent<TStepId, TEvents>,
    fromStep: TStepId,
    runVersion: number
  ):
    | { nextContext: TContext; earlyResult: null }
    | { nextContext: null; earlyResult: JourneySendResult<TContext, TStepId> } => {
    const snapshot = runtime.peekSnapshot();
    if (!transition.updateContext) {
      return { nextContext: snapshot.context, earlyResult: null };
    }

    try {
      const nextContext = (
        transition.updateContext as (
          args: JourneyTransitionUpdateContextArgsForEvent<
            TContext,
            TStepId,
            TEvents,
            typeof transitionEvent.type
          >
        ) => TContext
      )({
        snapshot: stabilizeSnapshot(snapshot),
        context: snapshot.context,
        from: snapshot.currentStepId,
        timeline: snapshot.history.timeline,
        index: snapshot.history.index,
        event: transitionEvent as JourneyTransitionArgsForEvent<
          TContext,
          TStepId,
          TEvents,
          THandlers,
          typeof transitionEvent.type
        >["event"]
      });

      return {
        nextContext: assertSerializableContext(nextContext),
        earlyResult: null
      };
    } catch (error) {
      if (!runtime.isRunActive(runVersion)) {
        return { nextContext: null, earlyResult: buildCanceledSendResult(transitionEvent.type) };
      }

      return {
        nextContext: null,
        earlyResult: buildTransitionErrorResult(
          fromStep,
          transitionEvent.type,
          error,
          transition.id,
          transition.label,
          runVersion
        )
      };
    }
  };

  return {
    buildCanceledSendResult,
    executeSend: async (
      event: RuntimeSendEvent<TStepId, TEvents>,
      runVersion: number,
      signal: AbortSignal
    ): Promise<JourneySendResult<TContext, TStepId>> => {
      if (runtime.peekSnapshot().status !== "running") {
        return buildCanceledSendResult(event.type);
      }

      const fromStep = runtime.peekSnapshot().currentStepId;
      const transitionEvent = event as RuntimeTransitionEvent<TStepId, TEvents>;
      runtime.emit({ type: "transition.start", from: fromStep, event, timestamp: now() });

      if (headless) {
        if (isGoToStepByIdEvent(event)) {
          return navigation.commitStepTransition(
            fromStep,
            event.stepId,
            transitionEvent,
            {
              from: fromStep,
              event: "goToStepById",
              to: event.stepId
            } as RuntimeTransition<TContext, TStepId, TEvents, THandlers>,
            runtime.peekSnapshot().context,
            runVersion
          );
        }

        if (
          event.type !== "completeJourney" &&
          event.type !== "terminateJourney" &&
          event.type !== "goToPreviousStep"
        ) {
          return dropAsNoMatch(event, fromStep);
        }
      }

      const transitionResolution = resolveTransitionsForSend(event, fromStep);
      if (transitionResolution.earlyResult) {
        return transitionResolution.earlyResult;
      }

      const selectionResolution = await selectTransitionForSend(
        transitionResolution.transitionsToEvaluate,
        transitionEvent,
        fromStep,
        runVersion,
        signal
      );
      if (selectionResolution.earlyResult) {
        return selectionResolution.earlyResult;
      }

      if (!runtime.isRunActive(runVersion)) {
        return buildCanceledSendResult(event.type);
      }

      const { transition } = selectionResolution;
      if (!transition) {
        return handleNoTransitionMatch(event, fromStep, runVersion);
      }

      asyncState.setStepIdle(fromStep, runVersion);

      const contextResolution = resolveNextContext(
        transition,
        transitionEvent,
        fromStep,
        runVersion
      );
      if (contextResolution.earlyResult) {
        return contextResolution.earlyResult;
      }

      const target = resolveTransitionTarget(transition);
      if (isTerminalTarget(target)) {
        return navigation.commitTerminalTransition(
          fromStep,
          target,
          transitionEvent,
          transition.id ?? null,
          transition,
          contextResolution.nextContext,
          runVersion
        );
      }

      return navigation.commitStepTransition(
        fromStep,
        target,
        transitionEvent,
        transition,
        contextResolution.nextContext,
        runVersion
      );
    }
  };
};
