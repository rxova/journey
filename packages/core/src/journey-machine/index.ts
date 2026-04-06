import { createJourneyMachineAsyncStateController } from "./async-state";
import { createJourneyMachineComputedGetter } from "./computed";
import { createJourneyMachineControls } from "./controls";
import {
  createJourneyMachineNavigationController,
  type JourneyLifecycleScheduler
} from "./navigation";
import { createJourneyMachinePluginController } from "./plugin-controller";
import { createJourneyMachineRuntime } from "./runtime";
import { createJourneyMachineSendController } from "./send";
import {
  assertSerializableContext,
  assertStepExists,
  buildInitialAsyncState,
  buildSendResult,
  buildSnapshot,
  cloneContext,
  cloneMetaValue,
  isTerminalTarget,
  now,
  validateFiniteTimeout,
  validateJourneyTransitions
} from "./helpers";
import { resolveJourneyDefinition } from "./resolve-journey-definition";

import type {
  JourneyDefinition,
  JourneyJsonObject,
  JourneyMachine,
  JourneyMachinePlugin,
  JourneyMachineOptions,
  JourneyMachineWithPlugins,
  JourneySendEvent,
  JourneySendResult
} from "../types";

/** Creates a journey machine from a definition and optional runtime/plugin options. */
export function createJourneyMachine<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown> = Record<never, never>,
  TStepMeta = unknown,
  THandlers extends Record<string, unknown> = Record<never, never>,
  TPlugins extends readonly JourneyMachinePlugin[] = []
>(
  journey: JourneyDefinition<TContext, TStepId, TEventMap, TStepMeta, THandlers>,
  options?: JourneyMachineOptions<TPlugins>
): JourneyMachineWithPlugins<TContext, TStepId, TEventMap, TStepMeta, THandlers, TPlugins> {
  if (!journey.steps || typeof journey.steps !== "object") {
    throw new Error("Journey steps must be a record object.");
  }

  if (
    journey.transitions !== undefined &&
    (journey.transitions === null ||
      (typeof journey.transitions !== "object" && !Array.isArray(journey.transitions)))
  ) {
    throw new Error("Journey transitions must be an array or an object map when provided.");
  }

  for (const stepId of Object.keys(journey.steps)) {
    if (stepId === "*" || stepId === "global" || stepId === "COMPLETE" || stepId === "TERMINATED") {
      throw new Error(`Step id "${stepId}" is reserved and cannot be used as a step name.`);
    }
  }

  if (journey.initial === undefined && !Array.isArray(journey.transitions)) {
    throw new Error(
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
  const initialContextTemplate = cloneContext(resolvedJourney.context);
  const stepMeta = Object.fromEntries(
    (Object.keys(resolvedJourney.steps) as TStepId[]).map((stepId) => [
      stepId,
      cloneMetaValue(resolvedJourney.steps[stepId].meta)
    ])
  ) as Record<TStepId, TStepMeta>;

  const buildInitialSnapshot = () =>
    buildSnapshot(
      [resolvedJourney.initial],
      0,
      cloneContext(initialContextTemplate),
      "idled",
      buildInitialAsyncState(resolvedJourney.steps)
    );

  const pluginController = createJourneyMachinePluginController<
    TContext,
    TStepId,
    TEventMap,
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
  const runtime = createJourneyMachineRuntime<TContext, TStepId, TEventMap>({
    snapshot: initialSnapshot,
    onSnapshotChange: pluginController.onSnapshotChange,
    onDispose: pluginController.dispose,
    ...(onListenerError !== undefined ? { onListenerError } : {})
  });
  const asyncState = createJourneyMachineAsyncStateController<TContext, TStepId, TEventMap>({
    runtime
  });

  let dispatchSend: (
    event: JourneySendEvent<TStepId, TEventMap>
  ) => Promise<JourneySendResult<TContext, TStepId>> = () =>
    Promise.resolve(buildSendResult(runtime.getSnapshot(), false));

  const scheduleLifecycle: JourneyLifecycleScheduler<TContext, TStepId, TEventMap, THandlers> = ({
    previousSnapshot,
    snapshot,
    from,
    to,
    event,
    transitionId,
    runVersion,
    transition
  }) => {
    const sourceStep = resolvedJourney.steps[from];
    const targetStep = isTerminalTarget(to) ? null : resolvedJourney.steps[to];
    const handlers = (resolvedJourney.handlers ?? {}) as THandlers;
    const dispatch = (nextEvent: JourneySendEvent<TStepId, TEventMap>) => {
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
        transitionId
      } as const;
      runtime.emit({
        type: "lifecycle.error",
        ...context,
        error,
        timestamp: now()
      });
      onLifecycleError?.(error, context);
    };

    void (async () => {
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
      } finally {
        runtime.closeLifecycle(lifecycleAbortController);
      }
    })();
  };

  const navigation = createJourneyMachineNavigationController<
    TContext,
    TStepId,
    TEventMap,
    THandlers
  >({
    runtime,
    steps: resolvedJourney.steps,
    transitions: resolvedJourney.transitions,
    scheduleLifecycle
  });

  const sendController = createJourneyMachineSendController<
    TContext,
    TStepId,
    TEventMap,
    THandlers
  >(
    runtime,
    asyncState,
    navigation,
    journey.transitions === undefined,
    resolvedJourney.steps,
    resolvedJourney.transitions,
    (resolvedJourney.handlers ?? {}) as THandlers,
    requireExplicitCompletion,
    defaultTimeoutMs
  );

  const controls = createJourneyMachineControls<TContext, TStepId, TEventMap>({
    runtime,
    asyncState,
    initial: resolvedJourney.initial,
    initialContext: initialContextTemplate,
    steps: resolvedJourney.steps
  });

  const getComputed = createJourneyMachineComputedGetter(
    journey,
    resolvedJourney,
    runtime.getSnapshot
  );

  const machine: JourneyMachine<TContext, TStepId, TEventMap, TStepMeta, THandlers> = {
    getSnapshot: runtime.getSnapshot,
    getStepMeta: (stepId) => cloneMetaValue(stepMeta[stepId]),
    getComputed,
    startJourney: controls.startJourney,
    subscribe: runtime.subscribe,
    subscribeSelector: runtime.subscribeSelector,
    subscribeEvent: runtime.subscribeEvent,
    subscribeStart: (listener) =>
      runtime.subscribeEvent((event) => {
        if (event.type === "journey.start") {
          listener(event);
        }
      }),
    subscribeReset: (listener) =>
      runtime.subscribeEvent((event) => {
        if (event.type === "journey.reset") {
          listener(event);
        }
      }),
    subscribeComplete: (listener) =>
      runtime.subscribeEvent((event) => {
        if (event.type === "journey.completed") {
          listener(event);
        }
      }),
    subscribeTerminate: (listener) =>
      runtime.subscribeEvent((event) => {
        if (event.type === "journey.terminated") {
          listener(event);
        }
      }),
    resetJourney: controls.resetJourney,
    updateContext: controls.updateContext,
    clearStepError: controls.clearStepError,
    dispose: controls.dispose,
    goToPreviousStep: (steps) =>
      runtime.queue(
        async (runVersion) =>
          navigation.applyPreviousNavigation(steps, "goToPreviousStep", runVersion),
        () => sendController.buildCanceledSendResult("goToPreviousStep")
      ),
    goToLastVisitedStep: () =>
      runtime.queue(
        async (runVersion) =>
          navigation.applyLastVisitedNavigation("goToLastVisitedStep", runVersion),
        () => sendController.buildCanceledSendResult("goToLastVisitedStep")
      ),
    goToNextStep: () =>
      machine.send({ type: "goToNextStep" } as JourneySendEvent<TStepId, TEventMap>),
    goToStepById: (stepId: TStepId) =>
      machine.send({ type: "goToStepById", stepId } as JourneySendEvent<TStepId, TEventMap>),
    terminateJourney: (payload) =>
      payload === undefined
        ? machine.send({ type: "terminateJourney" } as JourneySendEvent<TStepId, TEventMap>)
        : machine.send({
            type: "terminateJourney",
            payload
          } as JourneySendEvent<TStepId, TEventMap>),
    completeJourney: (payload) =>
      payload === undefined
        ? machine.send({ type: "completeJourney" } as JourneySendEvent<TStepId, TEventMap>)
        : machine.send({
            type: "completeJourney",
            payload
          } as JourneySendEvent<TStepId, TEventMap>),
    send: (event) =>
      runtime.queue(
        (runVersion, signal) => sendController.executeSend(event, runVersion, signal),
        () => sendController.buildCanceledSendResult(event.type)
      )
  };

  dispatchSend = machine.send;

  return pluginController.extendMachine(machine) as JourneyMachineWithPlugins<
    TContext,
    TStepId,
    TEventMap,
    TStepMeta,
    THandlers,
    TPlugins
  >;
}
