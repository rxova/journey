import {
  assertStepExists,
  buildSendResult,
  buildSnapshot,
  normalizeStepCount,
  now,
  transitionSnapshot
} from "./helpers";

import type {
  JourneyEvent,
  JourneyJsonObject,
  JourneySendResult,
  JourneySnapshot,
  JourneyTerminal,
  JourneyTransition
} from "../types";
import type { JourneyMachineRuntime } from "./runtime";

export type JourneyLifecycleScheduler<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown>,
  THandlers extends Record<string, unknown>
> = (args: {
  previousSnapshot: JourneySnapshot<TContext, TStepId>;
  snapshot: JourneySnapshot<TContext, TStepId>;
  from: TStepId;
  to: TStepId | JourneyTerminal;
  event:
    | JourneyEvent<TStepId, TEventMap>
    | { type: "goToLastVisitedStep" }
    | { type: "goToPreviousStep" };
  transitionId: string | null;
  runVersion: number;
  transition?: JourneyTransition<TContext, TStepId, TEventMap, THandlers>;
}) => void;

export type JourneyMachineNavigationController<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown>,
  THandlers extends Record<string, unknown>
> = {
  applyPreviousNavigation: (
    requestedSteps?: number,
    transitionId?: string,
    runVersion?: number
  ) => JourneySendResult<TContext, TStepId>;
  applyLastVisitedNavigation: (
    transitionId?: string,
    runVersion?: number
  ) => JourneySendResult<TContext, TStepId>;
  hasDeclaredTransitionForEvent: (fromStep: TStepId, eventType: string) => boolean;
  commitTerminalTransition: (
    fromStep: TStepId,
    target: JourneyTerminal,
    transitionEvent: { type: string },
    transitionId: string | null,
    transition: JourneyTransition<TContext, TStepId, TEventMap, THandlers> | undefined,
    nextContext: TContext,
    runVersion?: number
  ) => JourneySendResult<TContext, TStepId>;
  commitStepTransition: (
    fromStep: TStepId,
    target: TStepId,
    transitionEvent: JourneyEvent<TStepId, TEventMap>,
    transition: JourneyTransition<TContext, TStepId, TEventMap, THandlers>,
    nextContext: TContext,
    runVersion?: number
  ) => JourneySendResult<TContext, TStepId>;
};

export const createJourneyMachineNavigationController = <
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown>,
  THandlers extends Record<string, unknown>
>({
  runtime,
  steps,
  transitions,
  scheduleLifecycle
}: {
  runtime: JourneyMachineRuntime<TContext, TStepId, TEventMap>;
  steps: Record<TStepId, unknown>;
  transitions: readonly JourneyTransition<TContext, TStepId, TEventMap, THandlers>[];
  scheduleLifecycle: JourneyLifecycleScheduler<TContext, TStepId, TEventMap, THandlers>;
}): JourneyMachineNavigationController<TContext, TStepId, TEventMap, THandlers> => ({
  applyPreviousNavigation: (requestedSteps?: number, transitionId?: string, runVersion = 0) => {
    const snapshot = runtime.peekSnapshot();
    if (snapshot.status !== "running") {
      return buildSendResult(runtime.getSnapshot(), false);
    }

    const stepsToGoBack = normalizeStepCount(requestedSteps);
    if (snapshot.history.index === 0) {
      return buildSendResult(runtime.getSnapshot(), false);
    }

    const from = snapshot.currentStepId;
    const nextIndex = Math.max(0, snapshot.history.index - stepsToGoBack);
    const appliedSteps = snapshot.history.index - nextIndex;
    if (appliedSteps <= 0) {
      return buildSendResult(runtime.getSnapshot(), false);
    }

    runtime.emit({ type: "step.exit", stepId: from, timestamp: now() });
    const committedSnapshot = runtime.setSnapshot(
      buildSnapshot(
        snapshot.history.timeline,
        nextIndex,
        snapshot.context,
        snapshot.status,
        snapshot.async,
        snapshot.visited
      ),
      {
        notify: true,
        reason: "navigation"
      }
    );

    runtime.emit({
      type: "navigation.previous",
      from,
      to: committedSnapshot.currentStepId,
      requestedSteps: stepsToGoBack,
      appliedSteps,
      timestamp: now()
    });
    runtime.emit({ type: "step.enter", stepId: committedSnapshot.currentStepId, timestamp: now() });
    scheduleLifecycle({
      previousSnapshot: snapshot,
      snapshot: committedSnapshot,
      from,
      to: committedSnapshot.currentStepId,
      event: { type: "goToPreviousStep" },
      transitionId: transitionId ?? null,
      runVersion
    });

    return buildSendResult(committedSnapshot, true, {
      ...(transitionId !== undefined ? { transitionId } : {})
    });
  },
  applyLastVisitedNavigation: (transitionId?: string, runVersion = 0) => {
    const snapshot = runtime.peekSnapshot();
    if (snapshot.status !== "running") {
      return buildSendResult(runtime.getSnapshot(), false);
    }

    const targetIndex = snapshot.history.timeline.length - 1;
    if (snapshot.history.index >= targetIndex) {
      return buildSendResult(runtime.getSnapshot(), false);
    }

    const from = snapshot.currentStepId;
    runtime.emit({ type: "step.exit", stepId: from, timestamp: now() });
    const committedSnapshot = runtime.setSnapshot(
      buildSnapshot(
        snapshot.history.timeline,
        targetIndex,
        snapshot.context,
        snapshot.status,
        snapshot.async,
        snapshot.visited
      ),
      {
        notify: true,
        reason: "navigation"
      }
    );

    runtime.emit({
      type: "navigation.lastVisited",
      from,
      to: committedSnapshot.currentStepId,
      timestamp: now()
    });
    runtime.emit({ type: "step.enter", stepId: committedSnapshot.currentStepId, timestamp: now() });
    scheduleLifecycle({
      previousSnapshot: snapshot,
      snapshot: committedSnapshot,
      from,
      to: committedSnapshot.currentStepId,
      event: { type: "goToLastVisitedStep" },
      transitionId: transitionId ?? null,
      runVersion
    });

    return buildSendResult(committedSnapshot, true, {
      ...(transitionId !== undefined ? { transitionId } : {})
    });
  },
  hasDeclaredTransitionForEvent: (fromStep: TStepId, eventType: string) =>
    transitions.some((transition) => {
      const fromMatches = transition.from === "*" || transition.from === fromStep;
      return fromMatches && transition.event === eventType;
    }),
  commitTerminalTransition: (
    fromStep: TStepId,
    target: JourneyTerminal,
    transitionEvent: { type: string },
    transitionId: string | null,
    transition: JourneyTransition<TContext, TStepId, TEventMap, THandlers> | undefined,
    nextContext: TContext,
    runVersion = 0
  ) => {
    const snapshot = runtime.peekSnapshot();
    const normalizedTimeline = snapshot.history.timeline.slice(0, snapshot.history.index + 1);
    const committedSnapshot = runtime.setSnapshot(
      {
        ...snapshot,
        history: {
          timeline: normalizedTimeline,
          index: normalizedTimeline.length - 1
        },
        context: nextContext,
        status: target === "COMPLETE" ? "completed" : "terminated"
      },
      {
        notify: true,
        reason: "transition"
      }
    );

    runtime.emit({
      type: "transition.success",
      from: fromStep,
      to: target,
      eventType: transitionEvent.type,
      transitionId,
      timestamp: now()
    });
    runtime.emit({
      type: target === "COMPLETE" ? "journey.completed" : "journey.terminated",
      stepId: committedSnapshot.currentStepId,
      timestamp: now()
    });
    scheduleLifecycle({
      previousSnapshot: snapshot,
      snapshot: committedSnapshot,
      from: fromStep,
      to: target,
      event: transitionEvent as JourneyEvent<TStepId, TEventMap>,
      transitionId,
      runVersion,
      ...(transition !== undefined ? { transition } : {})
    });

    return buildSendResult(committedSnapshot, true, {
      ...(transitionId !== null ? { transitionId } : {})
    });
  },
  commitStepTransition: (
    fromStep: TStepId,
    target: TStepId,
    transitionEvent: JourneyEvent<TStepId, TEventMap>,
    transition: JourneyTransition<TContext, TStepId, TEventMap, THandlers>,
    nextContext: TContext,
    runVersion = 0
  ) => {
    assertStepExists(steps, target, `Transition points to unknown step "${target}".`);

    const snapshot = runtime.peekSnapshot();
    const beforeCurrent = snapshot.currentStepId;
    if (beforeCurrent !== target) {
      runtime.emit({ type: "step.exit", stepId: beforeCurrent, timestamp: now() });
    }

    const committedSnapshot = runtime.setSnapshot(
      transitionSnapshot(snapshot, target, nextContext),
      {
        notify: true,
        reason: "transition"
      }
    );

    runtime.emit({
      type: "transition.success",
      from: fromStep,
      to: committedSnapshot.currentStepId,
      eventType: transitionEvent.type,
      transitionId: transition.id ?? null,
      timestamp: now()
    });
    if (beforeCurrent !== committedSnapshot.currentStepId) {
      runtime.emit({
        type: "step.enter",
        stepId: committedSnapshot.currentStepId,
        timestamp: now()
      });
    }
    scheduleLifecycle({
      previousSnapshot: snapshot,
      snapshot: committedSnapshot,
      from: fromStep,
      to: committedSnapshot.currentStepId,
      event: transitionEvent,
      transitionId: transition.id ?? null,
      runVersion,
      transition
    });

    return buildSendResult(committedSnapshot, true, {
      ...(transition.id !== undefined ? { transitionId: transition.id } : {})
    });
  }
});
