import { createJourneyMachineAsyncStateController } from "./async-state";
import { createJourneyMachineComputedGetter } from "./computed";
import { createJourneyMachineControls } from "./controls";
import { attachJourneyMachineDevtoolsRegistry } from "./devtools-registry";
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
  isPromiseLike,
  isTerminalTarget,
  JOURNEY_AFTER_EVENT_PREFIX,
  JOURNEY_EFFECT_REJECTED_EVENT,
  JOURNEY_EFFECT_RESOLVED_EVENT,
  JourneyTimeoutError,
  now,
  resolveInitialSnapshotOption,
  resolveSnapshotShape,
  validateFiniteTimeout,
  validateJourneyTransitions,
  warnInDevelopment,
  withAbortSignal,
  withTimeout
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
  JourneySendResult,
  JourneyNoMatchContext
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

  // Step effects: declarative async work that runs on step entry. The runner
  // reuses the serialized send pipeline by dispatching a synthetic event that
  // the resolver wired to onResolved/onRejected transitions. One effect is
  // in-flight at a time; its lifecycle controller cancels it on step exit
  // (via `cancelActiveEffect`), reset, or dispose.
  let activeEffectController: AbortController | null = null;

  const cancelActiveEffect = () => {
    const controller = activeEffectController;
    if (!controller) {
      return;
    }
    activeEffectController = null;
    if (!controller.signal.aborted) {
      controller.abort();
    }
    runtime.closeLifecycle(controller);
  };

  // Delayed (`after`) transitions: timers started on entry, cancelled on step
  // exit / reset / dispose. The abort signal clears any pending timers.
  let activeAfterController: AbortController | null = null;

  const cancelActiveAfter = () => {
    const controller = activeAfterController;
    if (!controller) {
      return;
    }
    activeAfterController = null;
    if (!controller.signal.aborted) {
      controller.abort();
    }
    runtime.closeLifecycle(controller);
  };

  const runStepTimers = (stepId: TStepId, runVersion: number) => {
    const after = resolvedJourney.steps[stepId]?.after;
    if (!after || !runtime.isRunActive(runVersion)) {
      return;
    }

    const controller = runtime.openLifecycle(runVersion);
    if (!controller) {
      return;
    }
    activeAfterController = controller;
    const { signal } = controller;

    for (const delayKey of Object.keys(after)) {
      const delayMs = Number(delayKey);
      const handle = setTimeout(() => {
        if (
          signal.aborted ||
          !runtime.isRunActive(runVersion) ||
          runtime.peekSnapshot().currentStepId !== stepId
        ) {
          return;
        }
        void dispatchSend({
          type: `${JOURNEY_AFTER_EVENT_PREFIX}${delayMs}`
        } as unknown as JourneySendEvent<TStepId, TEvents>);
      }, delayMs);
      signal.addEventListener("abort", () => clearTimeout(handle), { once: true });
    }
  };

  const runStepEffect = (stepId: TStepId, runVersion: number) => {
    const effect = resolvedJourney.steps[stepId]?.effect;
    if (!effect || !runtime.isRunActive(runVersion)) {
      return;
    }

    const controller = runtime.openLifecycle(runVersion);
    if (!controller) {
      return;
    }
    activeEffectController = controller;
    const { signal } = controller;

    asyncState.setStepLoading(
      stepId,
      "invoking",
      JOURNEY_EFFECT_RESOLVED_EVENT,
      undefined,
      runVersion
    );

    void (async () => {
      let output: unknown;
      let failure: { error: unknown } | null = null;
      try {
        const result = effect.run({
          snapshot: runtime.getSnapshot(),
          context: runtime.peekSnapshot().context,
          from: stepId,
          handlers,
          signal
        });
        output = isPromiseLike(result)
          ? await withTimeout(
              withAbortSignal(result as PromiseLike<unknown>, signal),
              effect.timeoutMs ?? defaultTimeoutMs,
              () =>
                new JourneyTimeoutError(
                  `Step effect timed out after ${effect.timeoutMs ?? defaultTimeoutMs}ms (step: ${String(stepId)}).`
                )
            )
          : result;
      } catch (error) {
        failure = { error };
      } finally {
        if (activeEffectController === controller) {
          activeEffectController = null;
        }
        runtime.closeLifecycle(controller);
      }

      if (
        signal.aborted ||
        !runtime.isRunActive(runVersion) ||
        runtime.peekSnapshot().currentStepId !== stepId
      ) {
        return;
      }

      if (failure) {
        if (effect.onRejected) {
          void dispatchSend({
            type: JOURNEY_EFFECT_REJECTED_EVENT,
            payload: failure.error
          } as unknown as JourneySendEvent<TStepId, TEvents>);
        } else {
          asyncState.setStepError(
            stepId,
            JOURNEY_EFFECT_REJECTED_EVENT,
            failure.error,
            undefined,
            runVersion
          );
        }
        return;
      }

      if (effect.onResolved) {
        void dispatchSend({
          type: JOURNEY_EFFECT_RESOLVED_EVENT,
          payload: output
        } as unknown as JourneySendEvent<TStepId, TEvents>);
      } else {
        asyncState.setStepIdle(stepId, runVersion);
      }
    })();
  };

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
    cancelActiveEffect();
    cancelActiveAfter();
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
          runStepEffect(to as TStepId, runVersion);
        }
        // Entering a step with `after` timers starts them.
        if (runtime.isRunActive(runVersion) && targetStep?.after) {
          runStepTimers(to as TStepId, runVersion);
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
  const reportNoMatch =
    options?.onNoMatch ??
    ((context: JourneyNoMatchContext<string>) => {
      warnInDevelopment(
        `Journey event "${context.eventType}" matched no enabled transition from step "${context.from}" and was dropped.`
      );
    });

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

  const controls = createJourneyMachineControls<TContext, TStepId, TEvents>({
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

  // Pause is a transient runtime flag — deliberately NOT part of the snapshot
  // (and therefore never persisted). While paused, navigation and sends resolve
  // as no-ops carrying `noOpReason: "paused"`; `updateContext`, `startJourney`,
  // `resetJourney`, and `clearStepError` keep working. Only `resumeJourney()`
  // clears it. Internal effect/after routing flows through `send` too, so a
  // paused machine also holds effect-driven navigation.
  let paused = false;

  const buildPausedSendResult = () =>
    buildSendResult(runtime.getSnapshot(), false, { noOpReason: "paused" as const });

  const machine: JourneyMachine<TContext, TStepId, TEvents, TStepMeta, THandlers> = {
    getSnapshot: runtime.getSnapshot,
    getStepMeta: (stepId) => cloneMetaValue(stepMeta[stepId]),
    getComputed,
    startJourney: async () => {
      const { snapshot, started } = await controls.startJourney();
      // The initial step is not "entered" via a transition, so trigger its
      // effect/timers here — but only when this call actually performed the
      // idled→running transition, so a repeated (defensive) startJourney() can
      // never duplicate initial-step I/O or schedule duplicate `after` timers.
      if (started && !runtime.isDisposed()) {
        runStepEffect(runtime.peekSnapshot().currentStepId, runtime.getRunVersion());
        runStepTimers(runtime.peekSnapshot().currentStepId, runtime.getRunVersion());
      }
      return snapshot;
    },
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
    pauseJourney: () => {
      if (runtime.isDisposed()) {
        warnInDevelopment('Journey machine has been disposed; "pauseJourney" is a no-op.');
        return;
      }
      if (paused) {
        return;
      }
      paused = true;
      runtime.emit({
        type: "journey.paused",
        stepId: runtime.peekSnapshot().currentStepId,
        timestamp: now()
      });
    },
    resumeJourney: () => {
      if (runtime.isDisposed()) {
        warnInDevelopment('Journey machine has been disposed; "resumeJourney" is a no-op.');
        return;
      }
      if (!paused) {
        return;
      }
      paused = false;
      runtime.emit({
        type: "journey.resumed",
        stepId: runtime.peekSnapshot().currentStepId,
        timestamp: now()
      });
    },
    isPaused: () => paused,
    goToPreviousStep: (steps) =>
      paused
        ? Promise.resolve(buildPausedSendResult())
        : runtime.queue(
            async (runVersion) =>
              navigation.applyPreviousNavigation(steps, "goToPreviousStep", runVersion),
            () => sendController.buildCanceledSendResult("goToPreviousStep")
          ),
    goToLastVisitedStep: () =>
      paused
        ? Promise.resolve(buildPausedSendResult())
        : runtime.queue(
            async (runVersion) =>
              navigation.applyLastVisitedNavigation("goToLastVisitedStep", runVersion),
            () => sendController.buildCanceledSendResult("goToLastVisitedStep")
          ),
    goToNextStep: () =>
      machine.send({ type: "goToNextStep" } as JourneySendEvent<TStepId, TEvents>),
    goToStepById: (stepId: TStepId) =>
      machine.send({ type: "goToStepById", stepId } as JourneySendEvent<TStepId, TEvents>),
    terminateJourney: (payload) =>
      payload === undefined
        ? machine.send({ type: "terminateJourney" } as JourneySendEvent<TStepId, TEvents>)
        : machine.send({
            type: "terminateJourney",
            payload
          } as JourneySendEvent<TStepId, TEvents>),
    completeJourney: (payload) =>
      payload === undefined
        ? machine.send({ type: "completeJourney" } as JourneySendEvent<TStepId, TEvents>)
        : machine.send({
            type: "completeJourney",
            payload
          } as JourneySendEvent<TStepId, TEvents>),
    send: (event) =>
      paused
        ? Promise.resolve(buildPausedSendResult())
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
