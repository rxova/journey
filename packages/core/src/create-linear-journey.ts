import { createJourneyMachineAsyncStateController } from "./journey-machine/async-state";
import { createJourneyMachineComputedGetter } from "./journey-machine/computed";
import { createJourneyMachineControls } from "./journey-machine/controls";
import { attachJourneyMachineDevtoolsRegistry } from "./journey-machine/devtools-registry";
import { JourneyDefinitionError } from "./journey-machine/errors";
import {
  assertSerializableContext,
  assertStepExists,
  buildInitialAsyncState,
  buildSendResult,
  buildSnapshot,
  cloneContext,
  cloneMetaValue,
  createCanceledSendResultBuilder,
  normalizeStepCount,
  now,
  reportNoMatchInDevelopment,
  resolveInitialSnapshotOption,
  validateFiniteTimeout,
  warnInDevelopment
} from "./journey-machine/helpers";
import { createJourneyMachinePauseController } from "./journey-machine/pause";
import { createJourneyMachinePluginController } from "./journey-machine/plugin-controller";
import { resolveJourneyDefinition } from "./journey-machine/resolve-journey-definition";
import { createJourneyMachineRuntime } from "./journey-machine/runtime";
import { createJourneyMachineStepWorkController } from "./journey-machine/step-work";

import type { JourneySnapshotShape } from "./journey-machine/helpers";
import type {
  JourneyAfterTransition,
  JourneyDefinition,
  JourneyJsonObject,
  JourneyMachine,
  JourneyMachineOptions,
  JourneyMachinePlugin,
  JourneySendEvent,
  JourneySendResult,
  JourneySnapshot,
  JourneySnapshotStateBase,
  JourneyStepDefinition,
  JourneyStepEffect,
  LinearJourneyDefinition,
  LinearJourneyMachine,
  LinearJourneySnapshot,
  LinearNextStepInterceptor
} from "./types";
import type { JourneyEmpty } from "./types";

type LinearStepConfig<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  THandlers extends Record<string, unknown>
> = {
  meta?: unknown;
  onEnter?: (args: Record<string, unknown>) => void | Promise<void>;
  onLeave?: (args: Record<string, unknown>) => void | Promise<void>;
  effect?: JourneyStepEffect<TContext, TStepId, THandlers>;
  after?: Record<number, JourneyAfterTransition<TContext, TStepId>>;
};

type CommitMode = "advance" | "jump" | "previous" | "lastVisited";

/**
 * Derives the transplant snapshot used when a linear journey's step list
 * changes while state must survive (dynamic wizard steps): the timeline,
 * `visited`, and `visits` are filtered to surviving ids, the history index is
 * clamped, the active step stays active when it survived (else the nearest
 * surviving index, with a dev warning), and context/status carry over
 * verbatim. Returns `undefined` when nothing survives — start fresh instead.
 *
 * Feed the result to `createLinearJourney(definition, { initialSnapshot })`.
 */
export const deriveLinearTransplantSnapshot = <
  TContext extends JourneyJsonObject,
  TStepId extends string
>(
  previous: Pick<
    LinearJourneySnapshot<TContext, TStepId>,
    "currentStepId" | "history" | "context" | "visited" | "visits" | "status"
  >,
  nextStepIds: readonly TStepId[]
):
  | (JourneySnapshotStateBase<TContext, TStepId> & { visits: Record<TStepId, number> })
  | undefined => {
  const surviving = new Set(nextStepIds);
  const timeline = previous.history.timeline.filter((stepId) => surviving.has(stepId));

  if (timeline.length === 0) {
    return undefined;
  }

  let index: number;
  if (surviving.has(previous.currentStepId)) {
    index = timeline.lastIndexOf(previous.currentStepId);
  } else {
    index = Math.min(previous.history.index, timeline.length - 1);
    warnInDevelopment(
      `Linear journey active step "${previous.currentStepId}" does not survive the step change; ` +
        `falling back to "${timeline[index]}".`
    );
  }

  const visits = Object.fromEntries(
    nextStepIds.map((stepId) => [stepId, previous.visits[stepId] ?? 0])
  ) as Record<TStepId, number>;
  const visited = Object.fromEntries(
    /* v8 ignore next -- visits is total over nextStepIds by construction. */
    nextStepIds.map((stepId) => [stepId, (visits[stepId] ?? 0) > 0])
  ) as Record<TStepId, boolean>;

  return {
    currentStepId: timeline[index] as TStepId,
    history: { timeline, index },
    context: previous.context,
    visited,
    visits,
    status: previous.status
  };
};

/**
 * Creates a linear journey machine from an ordered steps array.
 *
 * This is a dedicated linear runtime: navigation is index-based over
 * `stepOrder` (no transition graph is consulted at runtime), `goToStepById`
 * and `goToStepByIndex` may jump anywhere, per-step `visits` counts are part
 * of the linear snapshot, and forward navigation can be intercepted per step
 * via `registerNextStepInterceptor`. Step `onEnter`/`onLeave`, `effect`, and
 * `after` behave as before. Plugins, persistence, devtools, and the
 * observation-event stream keep the shared machine contract.
 */
export function createLinearJourney<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TStepMeta = unknown,
  THandlers extends Record<string, unknown> = JourneyEmpty,
  TPlugins extends readonly JourneyMachinePlugin[] = []
>(
  def: LinearJourneyDefinition<TContext, TStepId, TStepMeta, THandlers>,
  options?: JourneyMachineOptions<TPlugins, THandlers>
): LinearJourneyMachine<TContext, TStepId, TStepMeta, THandlers, TPlugins> {
  // ── Definition parsing & validation ────────────────────────────────────────
  if (!Array.isArray(def.steps) || def.steps.length === 0) {
    throw new JourneyDefinitionError(
      "invalid-shape",
      "Linear journey steps must be a non-empty array."
    );
  }

  const stepOrder: TStepId[] = [];
  const stepConfigs = {} as Record<TStepId, LinearStepConfig<TContext, TStepId, THandlers>>;
  for (const entry of def.steps) {
    const id = (typeof entry === "string" ? entry : entry.id) as TStepId;
    if (id === "*" || id === "global" || id === "COMPLETE" || id === "TERMINATED") {
      throw new JourneyDefinitionError(
        "reserved-step-id",
        `Step id "${id}" is reserved and cannot be used as a step name.`
      );
    }
    if (id in stepConfigs) {
      throw new JourneyDefinitionError(
        "duplicate-step",
        `Linear journey steps must be unique; duplicate step id "${id}".`
      );
    }
    stepOrder.push(id);
    stepConfigs[id] =
      typeof entry === "string"
        ? {}
        : ({
            meta: entry.meta,
            onEnter: entry.onEnter,
            onLeave: entry.onLeave,
            effect: entry.effect,
            after: entry.after
          } as LinearStepConfig<TContext, TStepId, THandlers>);
  }

  let initial: TStepId;
  if (def.initial !== undefined) {
    if (!stepOrder.includes(def.initial)) {
      throw new JourneyDefinitionError(
        "unknown-step",
        `Linear journey "initial" step "${def.initial}" does not exist in the steps array.`
      );
    }
    initial = def.initial;
  } else if (def.startIndex !== undefined) {
    const startStep = stepOrder[def.startIndex];
    if (startStep === undefined) {
      throw new JourneyDefinitionError(
        "unknown-step",
        `Linear journey "startIndex" ${def.startIndex} is out of range (0..${stepOrder.length - 1}).`
      );
    }
    initial = startStep;
  } else {
    initial = stepOrder[0] as TStepId;
  }

  assertSerializableContext(def.context);
  validateFiniteTimeout(options?.defaultTimeoutMs, "Journey machine options");
  const requireExplicitCompletion = options?.requireExplicitCompletion ?? false;
  const defaultTimeoutMs = options?.defaultTimeoutMs;

  // Synthetic graph-shaped definition: purely DATA for plugins, devtools, and
  // structural tooling (diagnostics, execution paths). The runtime below never
  // consults these transitions — navigation is index-based.
  const stepsRecord = Object.fromEntries(
    stepOrder.map((stepId) => {
      const config = stepConfigs[stepId];
      return [
        stepId,
        {
          ...(config.meta !== undefined ? { meta: config.meta } : {}),
          ...(config.onEnter !== undefined ? { onEnter: config.onEnter } : {}),
          ...(config.onLeave !== undefined ? { onLeave: config.onLeave } : {}),
          ...(config.effect !== undefined ? { effect: config.effect } : {}),
          ...(config.after !== undefined ? { after: config.after } : {})
        }
      ];
    })
  ) as unknown as Record<
    TStepId,
    JourneyStepDefinition<TContext, TStepId, never, TStepMeta, THandlers>
  >;

  const journeyForPlugins: JourneyDefinition<TContext, TStepId, never, TStepMeta, THandlers> = {
    initial,
    context: def.context,
    ...(def.handlers !== undefined ? { handlers: def.handlers } : {}),
    steps: stepsRecord,
    transitions: stepOrder as unknown as readonly [TStepId, ...TStepId[]]
  };
  const resolvedJourney = resolveJourneyDefinition(journeyForPlugins);

  const handlers = {
    ...(def.handlers ?? {}),
    ...(options?.handlers ?? {})
  } as THandlers;
  const initialContextTemplate = cloneContext(def.context);
  const stepMeta = Object.fromEntries(
    stepOrder.map((stepId) => [stepId, cloneMetaValue(stepConfigs[stepId].meta)])
  ) as Record<TStepId, TStepMeta>;

  const shape: JourneySnapshotShape<TStepId> = { type: "linear", stepOrder };
  const indexOfStep = (stepId: TStepId): number => stepOrder.indexOf(stepId);

  const buildFreshSnapshot = () =>
    buildSnapshot(
      shape,
      [initial],
      0,
      cloneContext(initialContextTemplate),
      "idled",
      buildInitialAsyncState(stepsRecord)
    );

  const buildInitialSnapshot = () =>
    options?.initialSnapshot
      ? resolveInitialSnapshotOption<TContext, TStepId>(options.initialSnapshot, shape, stepsRecord)
      : buildFreshSnapshot();

  // ── Shared machine infrastructure ──────────────────────────────────────────
  const pluginController = createJourneyMachinePluginController<
    TContext,
    TStepId,
    never,
    TStepMeta,
    THandlers
  >({
    plugins: options?.plugins ?? [],
    setupContext: {
      journey: journeyForPlugins,
      resolvedJourney,
      options: { requireExplicitCompletion, defaultTimeoutMs },
      buildInitialSnapshot
    }
  });

  const initialSnapshot = pluginController.hydrateSnapshot(buildInitialSnapshot());
  assertSerializableContext(initialSnapshot.context, "Journey hydrated context");

  const onListenerError = options?.onListenerError;
  const onLifecycleError = options?.onLifecycleError;
  const runtime = createJourneyMachineRuntime<TContext, TStepId, never>({
    snapshot: initialSnapshot,
    onSnapshotChange: pluginController.onSnapshotChange,
    onDispose: pluginController.dispose,
    ...(onListenerError !== undefined ? { onListenerError } : {})
  });
  const asyncState = createJourneyMachineAsyncStateController<TContext, TStepId, never>({
    runtime
  });

  const reportNoMatch = options?.onNoMatch ?? reportNoMatchInDevelopment;

  const pause = createJourneyMachinePauseController<TContext, TStepId, never>({ runtime });
  const buildCanceledSendResult = createCanceledSendResultBuilder<TContext, TStepId>(runtime);

  // ── Forward-navigation interceptors ────────────────────────────────────────
  const nextInterceptors = new Map<TStepId, Set<LinearNextStepInterceptor<TContext>>>();
  const NEXT_INTERCEPTOR_ID = "next-interceptor";

  // ── Effects & after timers ─────────────────────────────────────────────────
  // The shared runner shell with linear routing: effect/after outcomes commit
  // through `queueBranchMove` (an internal branch move), never through `send`.
  const stepWork = createJourneyMachineStepWorkController<TContext, TStepId, never, THandlers>({
    runtime,
    asyncState,
    handlers,
    defaultTimeoutMs,
    getEffect: (stepId) => stepConfigs[stepId]?.effect,
    getAfter: (stepId) => stepConfigs[stepId]?.after,
    effectLoadingEventType: "effect.run",
    effectErrorEventType: "effect.run",
    routeEffectResolved: ({ stepId, onResolved, output }) => {
      queueBranchMove(
        stepId,
        onResolved.to,
        onResolved.updateContext
          ? (args) => onResolved.updateContext!({ ...args, output: output as never })
          : undefined,
        "effect.resolved"
      );
    },
    routeEffectRejected: ({ stepId, onRejected, error }) => {
      queueBranchMove(
        stepId,
        onRejected.to,
        onRejected.updateContext
          ? (args) => onRejected.updateContext!({ ...args, error })
          : undefined,
        "effect.rejected"
      );
    },
    routeAfterElapsed: ({ stepId, delayMs, transition }) => {
      queueBranchMove(stepId, transition.to, transition.updateContext, `after:${delayMs}`);
    }
  });

  // ── Commit primitives (always inside runtime.queue) ────────────────────────
  const currentVisits = (): Record<TStepId, number> =>
    (runtime.peekSnapshot() as LinearJourneySnapshot<TContext, TStepId>).visits;

  const bumpVisits = (target: TStepId): Record<TStepId, number> => ({
    ...currentVisits(),
    /* v8 ignore next -- snapshot visits are normalized over all steps. */
    [target]: (currentVisits()[target] ?? 0) + 1
  });

  const commitStep = (
    target: TStepId,
    mode: CommitMode,
    eventType: string,
    transitionId: string | null,
    runVersion: number,
    nextContext?: TContext,
    emitTransition = true,
    previousNav?: { requestedSteps: number; appliedSteps: number; targetIndex: number }
  ): JourneySendResult<TContext, TStepId> => {
    const snapshot = runtime.peekSnapshot();
    const from = snapshot.currentStepId;

    let nextTimeline: TStepId[];
    let nextIndex: number;
    if (mode === "advance" || mode === "jump") {
      nextTimeline = [...snapshot.history.timeline.slice(0, snapshot.history.index + 1), target];
      nextIndex = nextTimeline.length - 1;
    } else if (mode === "previous") {
      nextTimeline = [...snapshot.history.timeline];
      /* v8 ignore next -- previous commits always carry explicit nav info. */
      nextIndex = previousNav?.targetIndex ?? Math.max(0, snapshot.history.index - 1);
    } else {
      nextTimeline = [...snapshot.history.timeline];
      nextIndex = nextTimeline.length - 1;
    }

    stepWork.cancelStepWork();
    if (from !== target) {
      runtime.emit({ type: "step.exit", stepId: from, timestamp: now() });
    }

    const committedSnapshot = runtime.setSnapshot(
      buildSnapshot(
        shape,
        nextTimeline,
        nextIndex,
        nextContext ?? snapshot.context,
        snapshot.status,
        snapshot.async,
        undefined,
        bumpVisits(target)
      ),
      { notify: true, reason: mode === "advance" || mode === "jump" ? "transition" : "navigation" }
    );

    if (emitTransition && (mode === "advance" || mode === "jump")) {
      runtime.emit({
        type: "transition.success",
        from,
        to: committedSnapshot.currentStepId,
        eventType,
        transitionId,
        timestamp: now()
      });
    }
    if (mode === "previous") {
      runtime.emit({
        type: "navigation.previous",
        from,
        to: committedSnapshot.currentStepId,
        /* v8 ignore next 2 -- previous commits always carry explicit nav info. */
        requestedSteps: previousNav?.requestedSteps ?? 1,
        appliedSteps: previousNav?.appliedSteps ?? 1,
        timestamp: now()
      });
    }
    if (mode === "lastVisited") {
      runtime.emit({
        type: "navigation.lastVisited",
        from,
        to: committedSnapshot.currentStepId,
        timestamp: now()
      });
    }
    if (from !== committedSnapshot.currentStepId) {
      runtime.emit({
        type: "step.enter",
        stepId: committedSnapshot.currentStepId,
        timestamp: now()
      });
    }

    scheduleLifecycle(
      snapshot,
      committedSnapshot,
      from,
      target,
      eventType,
      transitionId,
      runVersion
    );

    return buildSendResult(committedSnapshot, true, {
      ...(transitionId !== null ? { transitionId } : {})
    });
  };

  const commitTerminal = (
    terminal: "COMPLETE" | "TERMINATED",
    eventType: string,
    runVersion: number
  ): JourneySendResult<TContext, TStepId> => {
    const snapshot = runtime.peekSnapshot();
    const from = snapshot.currentStepId;
    const normalizedTimeline = snapshot.history.timeline.slice(0, snapshot.history.index + 1);

    stepWork.cancelStepWork();
    const committedSnapshot = runtime.setSnapshot(
      {
        ...snapshot,
        history: { timeline: normalizedTimeline, index: normalizedTimeline.length - 1 },
        status: terminal === "COMPLETE" ? "completed" : "terminated"
      },
      { notify: true, reason: "transition" }
    );

    runtime.emit({
      type: "transition.success",
      from,
      to: terminal,
      eventType,
      transitionId: null,
      timestamp: now()
    });
    runtime.emit({
      type: terminal === "COMPLETE" ? "journey.completed" : "journey.terminated",
      stepId: committedSnapshot.currentStepId,
      timestamp: now()
    });

    scheduleLifecycle(snapshot, committedSnapshot, from, null, eventType, null, runVersion);

    return buildSendResult(committedSnapshot, true);
  };

  // ── Step lifecycle (onLeave/onEnter), effects, after timers ────────────────
  const scheduleLifecycle = (
    previousSnapshot: JourneySnapshot<TContext, TStepId>,
    snapshot: JourneySnapshot<TContext, TStepId>,
    from: TStepId,
    to: TStepId | null,
    eventType: string,
    transitionId: string | null,
    runVersion: number
  ) => {
    const sourceStep = stepConfigs[from];
    const targetStep = to === null ? null : stepConfigs[to];
    const controller = runtime.openLifecycle(runVersion);
    /* v8 ignore start -- openLifecycle only refuses when the run was already superseded. */
    if (!controller) {
      return;
    }
    /* v8 ignore stop */
    const { signal } = controller;

    const dispatch = (nextEvent: JourneySendEvent<TStepId, never>) => {
      /* v8 ignore next 3 -- guards dispatch from stale lifecycles after reset/dispose. */
      if (!runtime.isRunActive(runVersion) || runtime.isDisposed()) {
        return Promise.resolve(buildSendResult(runtime.getSnapshot(), false));
      }
      return machine.send(nextEvent);
    };

    const callbackArgs = (phaseSnapshot: JourneySnapshot<TContext, TStepId>) => ({
      snapshot: phaseSnapshot,
      context: phaseSnapshot.context,
      from,
      /* v8 ignore next -- terminal args are only built for completed/terminated commits. */
      to: to ?? (snapshot.status === "completed" ? "COMPLETE" : "TERMINATED"),
      event: { type: eventType } as never,
      transitionId,
      handlers,
      signal,
      dispatch
    });

    const reportLifecycleError = (error: unknown, phase: "step.onLeave" | "step.onEnter") => {
      const context = {
        phase,
        from,
        to:
          /* v8 ignore next -- terminal args are only built for completed/terminated commits. */
          to ?? (snapshot.status === "completed" ? ("COMPLETE" as const) : ("TERMINATED" as const)),
        eventType,
        transitionId
      };
      runtime.emit({ type: "lifecycle.error", ...context, error, timestamp: now() });
      onLifecycleError?.(error, context);
    };

    void (async () => {
      try {
        if (sourceStep?.onLeave) {
          try {
            await sourceStep.onLeave(callbackArgs(previousSnapshot));
          } catch (error) {
            /* v8 ignore next 3 -- races with reset/dispose; not deterministically reachable. */
            if (signal.aborted || !runtime.isRunActive(runVersion)) {
              return;
            }
            reportLifecycleError(error, "step.onLeave");
            return;
          }
        }

        if (!runtime.isRunActive(runVersion) || to === null) {
          return;
        }

        if (targetStep?.onEnter) {
          try {
            await targetStep.onEnter(callbackArgs(snapshot));
          } catch (error) {
            /* v8 ignore next 3 -- races with reset/dispose; not deterministically reachable. */
            if (signal.aborted || !runtime.isRunActive(runVersion)) {
              return;
            }
            reportLifecycleError(error, "step.onEnter");
            return;
          }
        }

        /* v8 ignore next -- guards effect/timer start against races with reset/navigation. */
        if (runtime.isRunActive(runVersion) && runtime.peekSnapshot().currentStepId === to) {
          stepWork.runStepEffect(to, runVersion);
          stepWork.runStepTimers(to, runVersion);
        }
      } finally {
        runtime.closeLifecycle(controller);
      }
    })();
  };

  const queueBranchMove = (
    sourceStep: TStepId,
    to: TStepId,
    updateContextFn:
      | ((args: {
          snapshot: JourneySnapshot<TContext, TStepId>;
          context: Readonly<TContext>;
          from: TStepId;
        }) => TContext)
      | undefined,
    eventType: string
  ) => {
    void runtime.queue(
      async (runVersion) => {
        const snapshot = runtime.peekSnapshot();
        /* v8 ignore next 3 -- branch moves race navigation/reset; both sides are defensive. */
        if (snapshot.status !== "running" || snapshot.currentStepId !== sourceStep) {
          return buildSendResult(runtime.getSnapshot(), false);
        }
        let nextContext = snapshot.context;
        if (updateContextFn) {
          nextContext = assertSerializableContext(
            updateContextFn({
              snapshot: runtime.getSnapshot(),
              context: snapshot.context,
              from: sourceStep
            })
          );
        }
        asyncState.setStepIdle(sourceStep, runVersion);
        // Effect/after moves are real navigation but internal transitions:
        // step.enter/exit are observable, transition.* is not (parity with
        // the graph engine's synthetic-event filtering).
        return commitStep(to, "jump", eventType, null, runVersion, nextContext, false);
      },
      () => buildCanceledSendResult(eventType)
    );
  };

  // ── Navigation entry points ────────────────────────────────────────────────
  const runNextInterceptors = async (): Promise<{ ok: boolean; error?: unknown }> => {
    const activeStepId = runtime.peekSnapshot().currentStepId;
    const interceptors = nextInterceptors.get(activeStepId);
    if (!interceptors || interceptors.size === 0) {
      return { ok: true };
    }

    asyncState.setStepLoading(activeStepId, "evaluating-when", "goToNextStep", NEXT_INTERCEPTOR_ID);
    try {
      for (const interceptor of [...interceptors]) {
        await interceptor({
          context: runtime.getSnapshot().context,
          updateContext: machine.updateContext as never
        });
      }
    } catch (error) {
      asyncState.setStepError(activeStepId, "goToNextStep", error, NEXT_INTERCEPTOR_ID);
      runtime.emit({
        type: "transition.error",
        from: activeStepId,
        eventType: "goToNextStep",
        transitionId: NEXT_INTERCEPTOR_ID,
        error,
        timestamp: now()
      });
      return { ok: false, error };
    }
    asyncState.setStepIdle(activeStepId);
    return { ok: true };
  };

  const adjacentTransitionId = (from: TStepId): string | null => {
    const resolved = resolvedJourney.transitions.find(
      (transition) => transition.from === from && transition.event === "goToNextStep"
    );
    /* v8 ignore next -- the resolver assigns ids to every adjacent edge. */
    return resolved?.id ?? null;
  };

  const goToNextStep = async (): Promise<JourneySendResult<TContext, TStepId>> => {
    if (pause.isPaused()) {
      return pause.buildPausedSendResult();
    }
    if (runtime.peekSnapshot().status !== "running") {
      return buildSendResult(runtime.getSnapshot(), false);
    }

    // Interceptors run OUTSIDE the action queue so they can await queued
    // operations (updateContext) without deadlocking — the commit below
    // re-validates the active step.
    const interceptorStep = runtime.peekSnapshot().currentStepId;
    const intercepted = await runNextInterceptors();
    if (!intercepted.ok) {
      return buildSendResult(runtime.getSnapshot(), false, { error: intercepted.error });
    }

    return runtime.queue(
      async (runVersion) => {
        const snapshot = runtime.peekSnapshot();
        if (snapshot.status !== "running" || snapshot.currentStepId !== interceptorStep) {
          return buildSendResult(runtime.getSnapshot(), false);
        }
        const fromIndex = indexOfStep(snapshot.currentStepId);
        runtime.emit({
          type: "transition.start",
          from: snapshot.currentStepId,
          event: { type: "goToNextStep" } as never,
          timestamp: now()
        });
        if (fromIndex === stepOrder.length - 1 || fromIndex === -1) {
          if (requireExplicitCompletion) {
            reportNoMatch({ from: snapshot.currentStepId, eventType: "goToNextStep" });
            return buildSendResult(runtime.getSnapshot(), false);
          }
          return commitTerminal("COMPLETE", "goToNextStep", runVersion);
        }
        return commitStep(
          stepOrder[fromIndex + 1] as TStepId,
          "advance",
          "goToNextStep",
          adjacentTransitionId(snapshot.currentStepId),
          runVersion
        );
      },
      () => buildCanceledSendResult("goToNextStep")
    );
  };

  const goToPreviousStep = (steps?: number): Promise<JourneySendResult<TContext, TStepId>> => {
    if (pause.isPaused()) {
      return Promise.resolve(pause.buildPausedSendResult());
    }
    return runtime.queue(
      async (runVersion) => {
        const snapshot = runtime.peekSnapshot();
        if (snapshot.status !== "running" || snapshot.history.index === 0) {
          return buildSendResult(runtime.getSnapshot(), false);
        }
        const requestedSteps = normalizeStepCount(steps);
        const nextIndex = Math.max(0, snapshot.history.index - requestedSteps);
        const target = snapshot.history.timeline[nextIndex] as TStepId;
        return commitStep(
          target,
          "previous",
          "goToPreviousStep",
          null,
          runVersion,
          undefined,
          true,
          {
            requestedSteps,
            appliedSteps: snapshot.history.index - nextIndex,
            targetIndex: nextIndex
          }
        );
      },
      () => buildCanceledSendResult("goToPreviousStep")
    );
  };

  const goToLastVisitedStep = (): Promise<JourneySendResult<TContext, TStepId>> => {
    if (pause.isPaused()) {
      return Promise.resolve(pause.buildPausedSendResult());
    }
    return runtime.queue(
      async (runVersion) => {
        const snapshot = runtime.peekSnapshot();
        const targetIndex = snapshot.history.timeline.length - 1;
        if (snapshot.status !== "running" || snapshot.history.index >= targetIndex) {
          return buildSendResult(runtime.getSnapshot(), false);
        }
        const target = snapshot.history.timeline[targetIndex] as TStepId;
        return commitStep(target, "lastVisited", "goToLastVisitedStep", null, runVersion);
      },
      () => buildCanceledSendResult("goToLastVisitedStep")
    );
  };

  const goToStepById = (stepId: TStepId): Promise<JourneySendResult<TContext, TStepId>> => {
    if (pause.isPaused()) {
      return Promise.resolve(pause.buildPausedSendResult());
    }
    assertStepExists(stepsRecord, stepId, `Cannot goToStepById unknown step "${stepId}".`);
    return runtime.queue(
      async (runVersion) => {
        const snapshot = runtime.peekSnapshot();
        if (snapshot.status !== "running") {
          return buildSendResult(runtime.getSnapshot(), false);
        }
        runtime.emit({
          type: "transition.start",
          from: snapshot.currentStepId,
          event: { type: "goToStepById", stepId } as never,
          timestamp: now()
        });
        if (snapshot.currentStepId === stepId) {
          reportNoMatch({ from: snapshot.currentStepId, eventType: "goToStepById" });
          return buildSendResult(runtime.getSnapshot(), false);
        }
        return commitStep(stepId, "jump", "goToStepById", null, runVersion);
      },
      () => buildCanceledSendResult("goToStepById")
    );
  };

  const goToStepByIndex = (index: number): Promise<JourneySendResult<TContext, TStepId>> => {
    const stepId = stepOrder[index];
    if (stepId === undefined) {
      return Promise.resolve(buildSendResult(runtime.getSnapshot(), false));
    }
    const currentIndex = indexOfStep(runtime.getSnapshot().currentStepId);
    const diff = index - currentIndex;
    // Stepper semantics: one forward = Next (interceptors apply); backward
    // walks history to the target's most recent occurrence (jumping instead
    // when the target was never visited on this path); larger forward jumps
    // go direct.
    if (diff === 1) {
      return goToNextStep();
    }
    if (diff < 0) {
      const history = runtime.getSnapshot().history;
      for (let position = history.index - 1; position >= 0; position -= 1) {
        if (history.timeline[position] === stepId) {
          return goToPreviousStep(history.index - position);
        }
      }
      return goToStepById(stepId as TStepId);
    }
    return goToStepById(stepId as TStepId);
  };

  const runTerminal = (
    terminal: "COMPLETE" | "TERMINATED",
    eventType: string
  ): Promise<JourneySendResult<TContext, TStepId>> => {
    if (pause.isPaused()) {
      return Promise.resolve(pause.buildPausedSendResult());
    }
    return runtime.queue(
      async (runVersion) => {
        const snapshot = runtime.peekSnapshot();
        if (snapshot.status !== "running") {
          return buildSendResult(runtime.getSnapshot(), false);
        }
        runtime.emit({
          type: "transition.start",
          from: snapshot.currentStepId,
          event: { type: eventType } as never,
          timestamp: now()
        });
        return commitTerminal(terminal, eventType, runVersion);
      },
      () => buildCanceledSendResult(eventType)
    );
  };

  // ── Controls & computed (shared machine infrastructure) ───────────────────
  const coreControls = createJourneyMachineControls<TContext, TStepId, never>({
    runtime,
    asyncState,
    initial,
    initialContext: initialContextTemplate,
    steps: stepsRecord,
    snapshotShape: shape
  });

  // `journeyForPlugins` carries the linear transitions array, so the shared
  // getter computes the `mode: "linear"` variant (stepOrder, isFirst/LastStep,
  // visits-derived flags) straight from the linear snapshot.
  const getComputed = createJourneyMachineComputedGetter(
    journeyForPlugins,
    resolvedJourney,
    runtime.getSnapshot
  );

  // ── Machine assembly ───────────────────────────────────────────────────────
  const machine: JourneyMachine<TContext, TStepId, never, TStepMeta, THandlers> = {
    getSnapshot: runtime.getSnapshot,
    getStepMeta: (stepId) => cloneMetaValue(stepMeta[stepId]),
    getComputed,
    controls: {
      start: async () => {
        const { snapshot, started } = await coreControls.startJourney();
        // The initial step's entry is already counted by the fresh snapshot's
        // timeline-derived visits (visited[initial] is true pre-start, and the
        // invariant requires visits >= 1). Start only flips the status; effects
        // and timers fire here exactly once, on the actual idled→running edge.
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
      complete: () => runTerminal("COMPLETE", "completeJourney"),
      terminate: () => runTerminal("TERMINATED", "terminateJourney")
    },
    send: (event) => {
      if (pause.isPaused()) {
        return Promise.resolve(pause.buildPausedSendResult());
      }
      const eventType = (event as { type: string }).type;
      switch (eventType) {
        case "goToNextStep":
          return goToNextStep();
        case "goToPreviousStep":
          return goToPreviousStep();
        case "goToStepById":
          return goToStepById((event as { stepId: TStepId }).stepId);
        case "completeJourney":
          return runTerminal("COMPLETE", "completeJourney");
        case "terminateJourney":
          return runTerminal("TERMINATED", "terminateJourney");
        default:
          return runtime.queue(
            async () => {
              const from = runtime.peekSnapshot().currentStepId;
              if (runtime.peekSnapshot().status === "running") {
                runtime.emit({
                  type: "transition.start",
                  from,
                  event: event as never,
                  timestamp: now()
                });
                reportNoMatch({ from, eventType });
              }
              return buildSendResult(runtime.getSnapshot(), false);
            },
            () => buildCanceledSendResult(eventType)
          );
      }
    },
    goToNextStep,
    goToStepById,
    goToPreviousStep,
    goToLastVisitedStep,
    updateContext: coreControls.updateContext,
    clearStepError: coreControls.clearStepError,
    dispose: coreControls.dispose,
    subscribe: runtime.subscribe,
    subscribeSelector: runtime.subscribeSelector,
    subscribeEvent: runtime.subscribeEvent
  };

  const registerNextStepInterceptor = (
    stepId: TStepId,
    interceptor: LinearNextStepInterceptor<TContext>
  ): (() => void) => {
    assertStepExists(stepsRecord, stepId, `Cannot intercept unknown step "${stepId}".`);
    let interceptors = nextInterceptors.get(stepId);
    if (!interceptors) {
      interceptors = new Set();
      nextInterceptors.set(stepId, interceptors);
    }
    interceptors.add(interceptor);
    return () => {
      interceptors.delete(interceptor);
    };
  };

  const extendedMachine = Object.assign(pluginController.extendMachine(machine), {
    goToStepByIndex,
    registerNextStepInterceptor
  });

  attachJourneyMachineDevtoolsRegistry(extendedMachine, {
    controls: {
      forceStepTransition: (stepId) => {
        assertStepExists(stepsRecord, stepId, `Unknown step "${stepId}".`);
        return runtime.queue(
          async (runVersion) => {
            const snapshot = runtime.peekSnapshot();
            if (snapshot.status !== "running" || snapshot.currentStepId === stepId) {
              return buildSendResult(runtime.getSnapshot(), false);
            }
            runtime.emit({
              type: "transition.start",
              from: snapshot.currentStepId,
              event: { type: "devtools.forceStep", stepId } as never,
              timestamp: now()
            });
            return commitStep(stepId, "jump", "goToStepById", "force-step", runVersion);
          },
          () => buildSendResult(runtime.getSnapshot(), false)
        );
      }
    },
    features: pluginController.getDevtoolsFeatures(extendedMachine),
    journey: journeyForPlugins,
    resolvedJourney
  });

  return extendedMachine as LinearJourneyMachine<TContext, TStepId, TStepMeta, THandlers, TPlugins>;
}
