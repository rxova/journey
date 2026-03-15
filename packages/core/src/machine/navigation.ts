import {
  assertStepExists,
  buildSendResult,
  buildSnapshot,
  normalizeStepCount,
  now,
  transitionSnapshot
} from "../machine-helpers";

import type {
  JourneyEvent,
  JourneyEventPayloadMap,
  JourneySendEvent,
  JourneySendResult,
  JourneySnapshot,
  JourneyTerminal,
  JourneyTransition
} from "../types";
import type { MachineAsyncStateController } from "./async-state";
import type { MachineRuntime } from "./runtime";

export type MachineNavigationController<
  TContext,
  TStepId extends string,
  TEventType extends string,
  TPayloadMap extends JourneyEventPayloadMap<TEventType>,
  TStepMeta
> = {
  applyPreviousNavigation: (
    requestedSteps?: number,
    transitionId?: string
  ) => JourneySendResult<TContext, TStepId, TStepMeta>;
  applyLastVisitedNavigation: (
    transitionId?: string
  ) => JourneySendResult<TContext, TStepId, TStepMeta>;
  applyDirectGoToStepById: (
    stepId: TStepId,
    fromStep: TStepId,
    runVersion: number
  ) => JourneySendResult<TContext, TStepId, TStepMeta>;
  hasDeclaredTransitionForEvent: (fromStep: TStepId, eventType: string) => boolean;
  commitTerminalTransition: (
    fromStep: TStepId,
    target: JourneyTerminal,
    transitionEvent: JourneySendEvent<TStepId, TEventType, TPayloadMap>,
    transitionId: string | null,
    nextContext: TContext
  ) => JourneySendResult<TContext, TStepId, TStepMeta>;
  commitStepTransition: (
    fromStep: TStepId,
    target: TStepId,
    transitionEvent: JourneyEvent<TStepId, TEventType, TPayloadMap>,
    transition: JourneyTransition<TContext, TStepId, TEventType, TPayloadMap>,
    nextContext: TContext
  ) => JourneySendResult<TContext, TStepId, TStepMeta>;
};

export const createMachineNavigationController = <
  TContext,
  TStepId extends string,
  TEventType extends string,
  TPayloadMap extends JourneyEventPayloadMap<TEventType>,
  TStepMeta
>({
  runtime,
  asyncState,
  steps,
  transitions
}: {
  runtime: MachineRuntime<TContext, TStepId, TEventType, TPayloadMap, TStepMeta>;
  asyncState: MachineAsyncStateController<TStepId>;
  steps: Record<TStepId, unknown>;
  transitions: readonly JourneyTransition<TContext, TStepId, TEventType, TPayloadMap>[];
}): MachineNavigationController<TContext, TStepId, TEventType, TPayloadMap, TStepMeta> => ({
  applyPreviousNavigation: (requestedSteps?: number, transitionId?: string) => {
    const snapshot = runtime.getSnapshot();
    if (snapshot.status !== "running") {
      return buildSendResult(snapshot, false);
    }

    const stepsToGoBack = normalizeStepCount(requestedSteps);
    if (snapshot.history.index === 0) {
      return buildSendResult(snapshot, false);
    }

    const from = snapshot.currentStepId;
    const nextIndex = Math.max(0, snapshot.history.index - stepsToGoBack);
    const appliedSteps = snapshot.history.index - nextIndex;
    if (appliedSteps <= 0) {
      return buildSendResult(snapshot, false);
    }

    runtime.emit({ type: "step.exit", stepId: from, timestamp: now() });
    const nextSnapshot = buildSnapshot(
      snapshot.history.timeline,
      nextIndex,
      snapshot.context,
      snapshot.status,
      snapshot.async,
      snapshot.stepMeta,
      snapshot.visited
    );
    runtime.setSnapshot(nextSnapshot, { persist: true, notify: true });

    runtime.emit({
      type: "navigation.previous",
      from,
      to: nextSnapshot.currentStepId,
      requestedSteps: stepsToGoBack,
      appliedSteps,
      timestamp: now()
    });
    runtime.emit({ type: "step.enter", stepId: nextSnapshot.currentStepId, timestamp: now() });
    return buildSendResult(nextSnapshot, true, {
      ...(transitionId !== undefined ? { transitionId } : {})
    });
  },
  applyLastVisitedNavigation: (transitionId?: string) => {
    const snapshot = runtime.getSnapshot();
    if (snapshot.status !== "running") {
      return buildSendResult(snapshot, false);
    }

    const targetIndex = snapshot.history.timeline.length - 1;
    if (snapshot.history.index >= targetIndex) {
      return buildSendResult(snapshot, false);
    }

    const from = snapshot.currentStepId;
    runtime.emit({ type: "step.exit", stepId: from, timestamp: now() });
    const nextSnapshot = buildSnapshot(
      snapshot.history.timeline,
      targetIndex,
      snapshot.context,
      snapshot.status,
      snapshot.async,
      snapshot.stepMeta,
      snapshot.visited
    );
    runtime.setSnapshot(nextSnapshot, { persist: true, notify: true });

    runtime.emit({
      type: "navigation.lastVisited",
      from,
      to: nextSnapshot.currentStepId,
      timestamp: now()
    });
    runtime.emit({ type: "step.enter", stepId: nextSnapshot.currentStepId, timestamp: now() });
    return buildSendResult(nextSnapshot, true, {
      ...(transitionId !== undefined ? { transitionId } : {})
    });
  },
  applyDirectGoToStepById: (stepId: TStepId, fromStep: TStepId, runVersion: number) => {
    asyncState.setStepIdle(fromStep, runVersion);

    const snapshot = runtime.getSnapshot();
    const beforeCurrent = snapshot.currentStepId;
    const nextSnapshot = transitionSnapshot(snapshot, stepId, snapshot.context);
    if (nextSnapshot.currentStepId !== beforeCurrent) {
      runtime.emit({ type: "step.exit", stepId: beforeCurrent, timestamp: now() });
    }

    runtime.setSnapshot(nextSnapshot, { persist: true, notify: true });

    runtime.emit({
      type: "transition.success",
      from: fromStep,
      to: nextSnapshot.currentStepId,
      eventType: "goToStepById",
      transitionId: null,
      timestamp: now()
    });

    if (nextSnapshot.currentStepId !== beforeCurrent) {
      runtime.emit({ type: "step.enter", stepId: nextSnapshot.currentStepId, timestamp: now() });
    }

    return buildSendResult(nextSnapshot, true);
  },
  hasDeclaredTransitionForEvent: (fromStep: TStepId, eventType: string) =>
    transitions.some((transition) => {
      const fromMatches = transition.from === "*" || transition.from === fromStep;
      return fromMatches && transition.event === eventType;
    }),
  commitTerminalTransition: (
    fromStep: TStepId,
    target: JourneyTerminal,
    transitionEvent: JourneySendEvent<TStepId, TEventType, TPayloadMap>,
    transitionId: string | null,
    nextContext: TContext
  ) => {
    const snapshot = runtime.getSnapshot();
    const normalizedTimeline = snapshot.history.timeline.slice(0, snapshot.history.index + 1);
    const nextSnapshot: JourneySnapshot<TContext, TStepId, TStepMeta> = {
      ...snapshot,
      history: {
        timeline: normalizedTimeline,
        index: normalizedTimeline.length - 1
      },
      context: nextContext,
      status: target === "COMPLETE" ? "complete" : "terminated"
    };
    runtime.setSnapshot(nextSnapshot, { persist: true, notify: true });

    runtime.emit({
      type: "transition.success",
      from: fromStep,
      to: target,
      eventType: transitionEvent.type,
      transitionId,
      timestamp: now()
    });
    runtime.emit({
      type: target === "COMPLETE" ? "journey.complete" : "journey.close",
      stepId: nextSnapshot.currentStepId,
      timestamp: now()
    });

    return buildSendResult(nextSnapshot, true, {
      ...(transitionId !== null ? { transitionId } : {})
    });
  },
  commitStepTransition: (
    fromStep: TStepId,
    target: TStepId,
    transitionEvent: JourneyEvent<TStepId, TEventType, TPayloadMap>,
    transition: JourneyTransition<TContext, TStepId, TEventType, TPayloadMap>,
    nextContext: TContext
  ) => {
    assertStepExists(steps, target, `Transition points to unknown step "${target}".`);

    const snapshot = runtime.getSnapshot();
    const beforeCurrent = snapshot.currentStepId;
    if (beforeCurrent !== target) {
      runtime.emit({ type: "step.exit", stepId: beforeCurrent, timestamp: now() });
    }

    const nextSnapshot: JourneySnapshot<TContext, TStepId, TStepMeta> = transitionSnapshot(
      snapshot,
      target,
      nextContext
    );
    runtime.setSnapshot(nextSnapshot, { persist: true, notify: true });

    runtime.emit({
      type: "transition.success",
      from: fromStep,
      to: nextSnapshot.currentStepId,
      eventType: transitionEvent.type,
      transitionId: transition.id ?? null,
      timestamp: now()
    });
    if (beforeCurrent !== nextSnapshot.currentStepId) {
      runtime.emit({ type: "step.enter", stepId: nextSnapshot.currentStepId, timestamp: now() });
    }

    return buildSendResult(nextSnapshot, true, {
      ...(transition.id !== undefined ? { transitionId: transition.id } : {})
    });
  }
});
