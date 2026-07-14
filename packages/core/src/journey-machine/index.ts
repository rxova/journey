import { createJourneyMachineAsyncStateController } from "./async-state";
import { createJourneyMachineComputedGetter } from "./computed";
import { createJourneyMachineControls } from "./controls";
import { attachJourneyMachineDevtoolsRegistry } from "./devtools-registry";
import {
  createJourneyMachineNavigationController,
  type JourneyLifecycleScheduler
} from "./navigation";
import { createJourneyMachinePauseController } from "./pause";
import { createJourneyMachinePluginController } from "./plugin-controller";
import { createJourneyMachineRuntime } from "./runtime";
import { createJourneyMachineSendController } from "./send";
import { createJourneyMachineStepWorkController } from "./step-work";
import {
  assertSerializableContext,
  assertStepExists,
  buildInitialAsyncState,
  buildSendResult,
  buildSnapshot,
  cloneContext,
  cloneMetaValue,
  isTerminalTarget,
  JOURNEY_AFTER_EVENT_PREFIX,
  JOURNEY_EFFECT_REJECTED_EVENT,
  JOURNEY_EFFECT_RESOLVED_EVENT,
  now,
  reportNoMatchInDevelopment,
  resolveInitialSnapshotOption,
  resolveSnapshotShape,
  validateFiniteTimeout,
  validateJourneyTransitions
} from "./helpers";
import { JourneyDefinitionError } from "./errors";
import { resolveJourneyDefinition } from "./resolve-journey-definition";

import type {
  JourneyBaseEvent,
  JourneyDefinition,
  JourneyJsonObject,
  JourneyMachine,
  JourneyMachinePlugin,
  JourneyMachineOptions,
  JourneyMachineWithPlugins,
  JourneySendEvent,
  JourneySendResult
} from "../types";
import type { JourneyEmpty } from "../types";

const DEVTOOLS_FORCE_STEP_ID = "devtools.forceStep";

/** Creates a journey machine from a definition and optional runtime/plugin options. */
export function createJourneyMachine<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEvents extends JourneyBaseEvent = never,
  TStepMeta = unknown,
  THandlers extends Record<string, unknown> = JourneyEmpty,
  TPlugins extends readonly JourneyMachinePlugin[] = []
>(
  journey: JourneyDefinition<TContext, TStepId, TEvents, TStepMeta, THandlers>,
  options?: JourneyMachineOptions<TPlugins, THandlers>
): JourneyMachineWithPlugins<TContext, TStepId, TEvents, TStepMeta, THandlers, TPlugins> {
  if (!journey.steps || typeof journey.steps !== "object") {
    throw new JourneyDefinitionError("invalid-shape", "Journey steps must be a record object.");
  }

  if (
    journey.transitions !== undefined &&
    (journey.transitions === null ||
      (typeof journey.transitions !== "object" && !Array.isArray(journey.transitions)))
  ) {
    throw new JourneyDefinitionError(
      "invalid-shape",
      "Journey transitions must be an array or an object map when provided."
    );
  }

  for (const stepId of Object.keys(journey.steps)) {
    if (stepId === "*" || stepId === "global" || stepId === "COMPLETE" || stepId === "TERMINATED") {
      throw new JourneyDefinitionError(
        "reserved-step-id",
        `Step id "${stepId}" is reserved and cannot be used as a step name.`
      );
    }
  }

  if (journey.initial === undefined && !Array.isArray(journey.transitions)) {
    throw new JourneyDefinitionError(
      "missing-initial",
      'Journey "initial" is required for graph and headless definitions. ' +
        "For linear transitions, initial defaults to the first array element."
    );
  }

  assertSerializableContext(journey.context);
  const resolvedJourney = resolveJourneyDefinition(journey);

  assertStepExists(
    resolvedJourney.steps,
    resolvedJourney.initial,
    `Journey initial step "${resolvedJourney.initial}" does not exist in steps registry.`
  );
  validateJourneyTransitions(resolvedJourney.transitions, resolvedJourney.steps);

  const requireExplicitCompletion = options?.requireExplicitCompletion ?? false;
  validateFiniteTimeout(options?.defaultTimeoutMs, "Journey machine options");
  const defaultTimeoutMs = options?.defaultTimeoutMs;
  // `handlers` are the dependency-injection seam. Creation-time overrides
  // (`options.handlers`) shallow-merge over the definition's handlers per-key,
  // so a test can swap a subset without rebuilding the definition.
  const handlers = {
    ...(resolvedJourney.handlers ?? {}),
    ...(options?.handlers ?? {})
  } as THandlers;
  const initialContextTemplate = cloneContext(resolvedJourney.context);
  const stepMeta = Object.fromEntries(
    (Object.keys(resolvedJourney.steps) as TStepId[]).map((stepId) => [
      stepId,
      cloneMetaValue(resolvedJourney.steps[stepId].meta)
    ])
  ) as Record<TStepId, TStepMeta>;

  const snapshotShape = resolveSnapshotShape<TStepId>(journey.transitions);

  const buildInitialSnapshot = () =>
    options?.initialSnapshot
      ? resolveInitialSnapshotOption<TContext, TStepId>(
          options.initialSnapshot,
          snapshotShape,
          resolvedJourney.steps
        )
      : buildSnapshot(
          snapshotShape,
          [resolvedJourney.initial],
          0,
          cloneContext(initialContextTemplate),
          "idled",
          buildInitialAsyncState(resolvedJourney.steps)
        );

  const pluginController = createJourneyMachinePluginController<
    TContext,
    TStepId,
    TEvents,
    TStepMeta,
    THandlers
  >({
    plugins: options?.plugins ?? [],
    setupContext: {
      journey,
      resolvedJourney,
      options: {
        requireExplicitCompletion,
        defaultTimeoutMs
      },
      buildInitialSnapshot
    }
  });

  const initialSnapshot = pluginController.hydrateSnapshot(buildInitialSnapshot());
  assertSerializableContext(initialSnapshot.context, "Journey hydrated context");

  const onListenerError = options?.onListenerError;
  const onLifecycleError = options?.onLifecycleError;
  const runtime = createJourneyMachineRuntime<TContext, TStepId, TEvents>({
    snapshot: initialSnapshot,
    onSnapshotChange: pluginController.onSnapshotChange,
    onDispose: pluginController.dispose,
    ...(onListenerError !== undefined ? { onListenerError } : {})
  });
  const asyncState = createJourneyMachineAsyncStateController<TContext, TStepId, TEvents>({
    runtime
  });

  let dispatchSend: (
    event: JourneySendEvent<TStepId, TEvents>
  ) => Promise<JourneySendResult<TContext, TStepId>> = () =>
    Promise.resolve(buildSendResult(runtime.getSnapshot(), false));

  // Step effects and `after` timers: declarative async work that runs on step
  // entry. The graph engine routes every outcome back through the serialized
  // send pipeline by dispatching a synthetic event that the resolver wired to
  // onResolved/onRejected/after transitions. Work is cancelled on step exit
  // (via `cancelStepWork` in `scheduleLifecycle`), reset, or dispose.
  const stepWork = createJourneyMachineStepWorkController<TContext, TStepId, TEvents, THandlers>({
    runtime,
    asyncState,
    handlers,
    defaultTimeoutMs,
    getEffect: (stepId) => resolvedJourney.steps[stepId]?.effect,
    getAfter: (stepId) => resolvedJourney.steps[stepId]?.after,
    effectLoadingEventType: JOURNEY_EFFECT_RESOLVED_EVENT,
    effectErrorEventType: JOURNEY_EFFECT_REJECTED_EVENT,
    routeEffectResolved: ({ output }) => {
      void dispatchSend({
        type: JOURNEY_EFFECT_RESOLVED_EVENT,
        payload: output
      } as unknown as JourneySendEvent<TStepId, TEvents>);
    },
    routeEffectRejected: ({ error }) => {
      void dispatchSend({
        type: JOURNEY_EFFECT_REJECTED_EVENT,
        payload: error
      } as unknown as JourneySendEvent<TStepId, TEvents>);
    },
    routeAfterElapsed: ({ delayMs }) => {
      void dispatchSend({
        type: `${JOURNEY_AFTER_EVENT_PREFIX}${delayMs}`
      } as unknown as JourneySendEvent<TStepId, TEvents>);
    }
  });

  const scheduleLifecycle: JourneyLifecycleScheduler<TContext, TStepId, TEvents, THandlers> = ({
    previousSnapshot,
    snapshot,
    from,
    to,
    event,
    transitionId,
    label,
    runVersion,
    transition
  }) => {
    // Leaving the current step cancels its in-flight effect and timers.
    stepWork.cancelStepWork();
    const sourceStep = resolvedJourney.steps[from];
    const targetStep = isTerminalTarget(to) ? null : resolvedJourney.steps[to];
    const dispatch = (nextEvent: JourneySendEvent<TStepId, TEvents>) => {
      if (!runtime.isRunActive(runVersion) || runtime.isDisposed()) {
        return Promise.resolve(buildSendResult(runtime.getSnapshot(), false));
      }
      return dispatchSend(nextEvent);
    };
    const lifecycleAbortController = runtime.openLifecycle(runVersion);
    if (!lifecycleAbortController) {
      return;
    }
    const { signal } = lifecycleAbortController;
    const reportLifecycleError = (
      error: unknown,
      phase: "step.onLeave" | "transition.onLeave" | "step.onEnter" | "transition.onEnter"
    ) => {
      const context = {
        phase,
        from,
        to,
        eventType: event.type,
        transitionId,
        ...(label !== undefined ? { label } : {})
      } as const;
      runtime.emit({
        type: "lifecycle.error",
        ...context,
        error,
        timestamp: now()
      });
      onLifecycleError?.(error, context);
    };

    const lifecyclePromise = (async () => {
      try {
        if (sourceStep?.onLeave) {
          try {
            await sourceStep.onLeave({
              snapshot: previousSnapshot,
              context: previousSnapshot.context,
              from,
              to,
              event,
              transitionId,
              ...(label !== undefined ? { label } : {}),
              handlers,
              signal,
              dispatch
            });
          } catch (error) {
            if (signal.aborted || !runtime.isRunActive(runVersion)) {
              return;
            }
            reportLifecycleError(error, "step.onLeave");
            return;
          }
        }

        if (!runtime.isRunActive(runVersion)) {
          return;
        }

        if (transition?.onLeave) {
          try {
            await transition.onLeave({
              snapshot: previousSnapshot,
              context: previousSnapshot.context,
              from,
              to,
              event,
              transitionId,
              ...(transition.label !== undefined ? { label: transition.label } : {}),
              handlers,
              signal,
              dispatch
            });
          } catch (error) {
            if (signal.aborted || !runtime.isRunActive(runVersion)) {
              return;
            }
            reportLifecycleError(error, "transition.onLeave");
            return;
          }
        }

        if (!runtime.isRunActive(runVersion)) {
          return;
        }

        if (targetStep?.onEnter) {
          try {
            await targetStep.onEnter({
              snapshot,
              context: snapshot.context,
              from,
              to,
              event,
              transitionId,
              ...(label !== undefined ? { label } : {}),
              handlers,
              signal,
              dispatch
            });
          } catch (error) {
            if (signal.aborted || !runtime.isRunActive(runVersion)) {
              return;
            }
            reportLifecycleError(error, "step.onEnter");
            return;
          }
        }

        if (!runtime.isRunActive(runVersion)) {
          return;
        }

        if (transition?.onEnter) {
          try {
            await transition.onEnter({
              snapshot,
              context: snapshot.context,
              from,
              to,
              event,
              transitionId,
              ...(transition.label !== undefined ? { label: transition.label } : {}),
              handlers,
              signal,
              dispatch
            });
          } catch (error) {
            if (signal.aborted || !runtime.isRunActive(runVersion)) {
              return;
            }
            reportLifecycleError(error, "transition.onEnter");
            return;
          }
        }

        // Entering a step with an effect starts it after entry callbacks settle.
        if (runtime.isRunActive(runVersion) && targetStep?.effect) {
          stepWork.runStepEffect(to as TStepId, runVersion);
        }
        // Entering a step with `after` timers starts them.
        if (runtime.isRunActive(runVersion) && targetStep?.after) {
          stepWork.runStepTimers(to as TStepId, runVersion);
        }
      } finally {
        runtime.closeLifecycle(lifecycleAbortController);
      }
    })();

    lifecyclePromise.catch(() => {
      // Per-phase errors are already routed through reportLifecycleError
      // inside the IIFE. This terminal catch only guards against throws
      // from the finally-block cleanup or the reporter itself, which must
      // not escape as an unhandled rejection.
    });
  };

  const navigation = createJourneyMachineNavigationController<
    TContext,
    TStepId,
    TEvents,
    THandlers
  >({
    runtime,
    steps: resolvedJourney.steps,
    transitions: resolvedJourney.transitions,
    scheduleLifecycle
  });

  // A dropped event (no matching/passing transition) reports through the
  // `onNoMatch` hook when provided, otherwise a development-only warning — the
  // same "hook, or dev fallback" shape as `onListenerError`.
  const reportNoMatch = options?.onNoMatch ?? reportNoMatchInDevelopment;

  const sendController = createJourneyMachineSendController<TContext, TStepId, TEvents, THandlers>(
    runtime,
    asyncState,
    navigation,
    journey.transitions === undefined,
    resolvedJourney.steps,
    resolvedJourney.transitions,
    handlers,
    requireExplicitCompletion,
    defaultTimeoutMs,
    reportNoMatch
  );

  const coreControls = createJourneyMachineControls<TContext, TStepId, TEvents>({
    runtime,
    asyncState,
    initial: resolvedJourney.initial,
    initialContext: initialContextTemplate,
    steps: resolvedJourney.steps,
    snapshotShape
  });

  const getComputed = createJourneyMachineComputedGetter(
    journey,
    resolvedJourney,
    runtime.getSnapshot
  );

  const pause = createJourneyMachinePauseController<TContext, TStepId, TEvents>({ runtime });

  const machine: JourneyMachine<TContext, TStepId, TEvents, TStepMeta, THandlers> = {
    getSnapshot: runtime.getSnapshot,
    getStepMeta: (stepId) => cloneMetaValue(stepMeta[stepId]),
    getComputed,
    controls: {
      start: async () => {
        const { snapshot, started } = await coreControls.startJourney();
        // The initial step is not "entered" via a transition, so trigger its
        // effect/timers here — but only when this call actually performed the
        // idled→running transition, so a repeated (defensive) start() can
        // never duplicate initial-step I/O or schedule duplicate `after` timers.
        if (started && !runtime.isDisposed()) {
          stepWork.runStepEffect(runtime.peekSnapshot().currentStepId, runtime.getRunVersion());
          stepWork.runStepTimers(runtime.peekSnapshot().currentStepId, runtime.getRunVersion());
        }
        return snapshot;
      },
      reset: coreControls.resetJourney,
      pause: pause.pause,
      resume: pause.resume,
      isPaused: pause.isPaused,
      terminate: (payload) =>
        payload === undefined
          ? machine.send({ type: "terminateJourney" } as JourneySendEvent<TStepId, TEvents>)
          : machine.send({
              type: "terminateJourney",
              payload
            } as JourneySendEvent<TStepId, TEvents>),
      complete: (payload) =>
        payload === undefined
          ? machine.send({ type: "completeJourney" } as JourneySendEvent<TStepId, TEvents>)
          : machine.send({
              type: "completeJourney",
              payload
            } as JourneySendEvent<TStepId, TEvents>)
    },
    subscribe: runtime.subscribe,
    subscribeSelector: runtime.subscribeSelector,
    subscribeEvent: runtime.subscribeEvent,
    updateContext: coreControls.updateContext,
    clearStepError: coreControls.clearStepError,
    dispose: coreControls.dispose,
    goToPreviousStep: (steps) =>
      pause.isPaused()
        ? Promise.resolve(pause.buildPausedSendResult())
        : runtime.queue(
            async (runVersion) =>
              navigation.applyPreviousNavigation(steps, "goToPreviousStep", runVersion),
            () => sendController.buildCanceledSendResult("goToPreviousStep")
          ),
    goToLastVisitedStep: () =>
      pause.isPaused()
        ? Promise.resolve(pause.buildPausedSendResult())
        : runtime.queue(
            async (runVersion) =>
              navigation.applyLastVisitedNavigation("goToLastVisitedStep", runVersion),
            () => sendController.buildCanceledSendResult("goToLastVisitedStep")
          ),
    goToNextStep: () =>
      machine.send({ type: "goToNextStep" } as JourneySendEvent<TStepId, TEvents>),
    goToStepById: (stepId: TStepId) =>
      machine.send({ type: "goToStepById", stepId } as JourneySendEvent<TStepId, TEvents>),
    send: (event) =>
      pause.isPaused()
        ? Promise.resolve(pause.buildPausedSendResult())
        : runtime.queue(
            (runVersion, signal) => sendController.executeSend(event, runVersion, signal),
            () => sendController.buildCanceledSendResult(event.type)
          )
  };

  dispatchSend = machine.send;

  const extendedMachine = pluginController.extendMachine(machine);
  attachJourneyMachineDevtoolsRegistry(extendedMachine, {
    controls: {
      forceStepTransition: (stepId) => {
        assertStepExists(resolvedJourney.steps, stepId, `Unknown step "${stepId}".`);

        return runtime.queue(
          async (runVersion) => {
            const snapshot = runtime.peekSnapshot();
            if (snapshot.status !== "running") {
              return buildSendResult(runtime.getSnapshot(), false);
            }

            runtime.emit({
              type: "transition.start",
              from: snapshot.currentStepId,
              event: {
                type: DEVTOOLS_FORCE_STEP_ID,
                stepId
              } as unknown as JourneySendEvent<TStepId, TEvents>,
              timestamp: now()
            });

            return navigation.commitStepTransition(
              snapshot.currentStepId,
              stepId,
              { type: DEVTOOLS_FORCE_STEP_ID, stepId } as unknown as JourneySendEvent<
                TStepId,
                TEvents
              >,
              {
                id: DEVTOOLS_FORCE_STEP_ID,
                from: snapshot.currentStepId,
                event: "goToStepById",
                to: stepId,
                label: "force-step"
              } as never,
              snapshot.context,
              runVersion
            );
          },
          () => buildSendResult(runtime.getSnapshot(), false)
        );
      }
    },
    features: pluginController.getDevtoolsFeatures(extendedMachine),
    journey,
    resolvedJourney
  });

  return extendedMachine as JourneyMachineWithPlugins<
    TContext,
    TStepId,
    TEvents,
    TStepMeta,
    THandlers,
    TPlugins
  >;
}
