/* eslint-disable no-redeclare */
import { resolveTransitionTarget } from "../../journey-machine/helpers";
import { resolveJourneyDefinition } from "../../journey-machine/resolve-journey-definition";

import type {
  JourneyDefinition,
  JourneyDiagnosticsIssue,
  JourneyDiagnosticsOptions,
  JourneyDiagnosticsResult,
  JourneyFullEventType,
  JourneyJsonObject,
  JourneyMode
} from "../../types";

const buildShadowKey = (from: string, event: string) => `${from}\u0000${event}`;

/** Analyzes a journey definition for structural diagnostics such as dead ends and cycles. */
export function getJourneyDiagnostics<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown>,
  TStepMeta = unknown,
  THandlers extends Record<string, unknown> = Record<never, never>
>(
  journey: JourneyDefinition<TContext, TStepId, TEventMap, TStepMeta, THandlers>,
  options?: JourneyDiagnosticsOptions
): JourneyDiagnosticsResult<TStepId, JourneyFullEventType<TEventMap>>;
export function getJourneyDiagnostics<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown>,
  TStepMeta = unknown,
  THandlers extends Record<string, unknown> = Record<never, never>
>(
  journey: JourneyDefinition<TContext, TStepId, TEventMap, TStepMeta, THandlers>,
  options: JourneyDiagnosticsOptions = {}
): JourneyDiagnosticsResult<TStepId, JourneyFullEventType<TEventMap>> {
  type TEventType = JourneyFullEventType<TEventMap>;
  const resolvedJourney = resolveJourneyDefinition(journey);
  const mode: JourneyMode =
    journey.transitions === undefined
      ? "headless"
      : Array.isArray(journey.transitions)
        ? "linear"
        : "graph";
  const stepIds = Object.keys(resolvedJourney.steps) as TStepId[];
  const issues: JourneyDiagnosticsIssue<TStepId, TEventType>[] = [];
  const requireExplicitCompletion = options.requireExplicitCompletion ?? false;
  const graphChecksSkipped = mode === "headless";

  if (graphChecksSkipped) {
    return {
      issues,
      summary: {
        mode,
        stepCount: stepIds.length,
        reachableStepCount: stepIds.length > 0 ? 1 : 0,
        unreachableStepCount: 0,
        deadEndCount: 0,
        cycleCount: 0,
        duplicateTransitionIdCount: 0,
        shadowedTransitionCount: 0,
        graphChecksSkipped: true,
        terminalPathExists: false
      }
    };
  }

  const shadowedTransitionIndexes = new Set<number>();
  const unconditionalTransitionByKey = new Map<string, { transitionId: string | null }>();

  resolvedJourney.transitions.forEach((transition, index) => {
    const key = buildShadowKey(transition.from, transition.event);
    const blocker = unconditionalTransitionByKey.get(key);

    if (blocker) {
      shadowedTransitionIndexes.add(index);
      issues.push({
        code: "shadowed-transition",
        severity: "warning",
        from: transition.from,
        eventType: transition.event as TEventType,
        ...(transition.id !== undefined ? { transitionId: transition.id } : {}),
        message:
          blocker.transitionId === null
            ? `Transition "${transition.from}.${transition.event}" is shadowed by an earlier unconditional transition.`
            : `Transition "${transition.from}.${transition.event}" is shadowed by unconditional transition "${blocker.transitionId}".`
      });
      return;
    }

    if (transition.when === undefined) {
      unconditionalTransitionByKey.set(key, {
        transitionId: transition.id ?? null
      });
    }
  });

  const transitionIdCounts = new Map<string, number>();
  for (const transition of resolvedJourney.transitions) {
    if (transition.id === undefined) {
      continue;
    }

    transitionIdCounts.set(transition.id, (transitionIdCounts.get(transition.id) ?? 0) + 1);
  }

  for (const [transitionId, count] of transitionIdCounts) {
    if (count < 2) {
      continue;
    }

    issues.push({
      code: "duplicate-transition-id",
      severity: "error",
      transitionId,
      message: `Transition id "${transitionId}" is declared ${count} times.`
    });
  }

  const activeTransitions = resolvedJourney.transitions.filter(
    (_, index) => !shadowedTransitionIndexes.has(index)
  );
  const isImplicitlyTerminalStep = (stepId: TStepId) =>
    mode === "linear" &&
    Array.isArray(journey.transitions) &&
    journey.transitions[journey.transitions.length - 1] !== undefined &&
    (typeof journey.transitions[journey.transitions.length - 1] === "string"
      ? journey.transitions[journey.transitions.length - 1]
      : journey.transitions[journey.transitions.length - 1].step) === stepId &&
    !requireExplicitCompletion;

  const getOutgoingTransitions = (stepId: TStepId) =>
    activeTransitions.filter((transition) => transition.from === "*" || transition.from === stepId);

  const reachable = new Set<TStepId>();
  const markReachable = (stepId: TStepId) => {
    if (reachable.has(stepId)) {
      return;
    }

    reachable.add(stepId);
    for (const transition of getOutgoingTransitions(stepId)) {
      const target = resolveTransitionTarget(transition);
      if (target === "COMPLETE" || target === "TERMINATED") {
        continue;
      }
      markReachable(target);
    }
  };
  markReachable(resolvedJourney.initial);

  for (const stepId of stepIds) {
    if (reachable.has(stepId)) {
      continue;
    }

    issues.push({
      code: "unreachable-step",
      severity: "warning",
      stepId,
      message: `Step "${stepId}" is unreachable from the initial step "${resolvedJourney.initial}".`
    });
  }

  for (const stepId of reachable) {
    if (isImplicitlyTerminalStep(stepId)) {
      continue;
    }

    if (getOutgoingTransitions(stepId).length > 0) {
      continue;
    }

    issues.push({
      code: "dead-end-step",
      severity: "error",
      stepId,
      message: `Step "${stepId}" is reachable but has no outgoing transitions or terminal exit.`
    });
  }

  const cycleKeys = new Set<string>();
  const visitedForCycles = new Set<TStepId>();
  const stack: TStepId[] = [];

  const walkCycles = (stepId: TStepId) => {
    visitedForCycles.add(stepId);
    stack.push(stepId);

    for (const transition of getOutgoingTransitions(stepId)) {
      const target = resolveTransitionTarget(transition);
      if (target === "COMPLETE" || target === "TERMINATED") {
        continue;
      }

      const stackIndex = stack.indexOf(target);
      if (stackIndex >= 0) {
        const cycleSteps = [...stack.slice(stackIndex), target];
        const cycleKey = cycleSteps.join("\u0000");
        if (!cycleKeys.has(cycleKey)) {
          cycleKeys.add(cycleKey);
          issues.push({
            code: "cycle-detected",
            severity: "warning",
            from: transition.from,
            eventType: transition.event as TEventType,
            ...(transition.id !== undefined ? { transitionId: transition.id } : {}),
            steps: cycleSteps,
            message: `Cycle detected: ${cycleSteps.join(" -> ")}.`
          });
        }
        continue;
      }

      if (!visitedForCycles.has(target)) {
        walkCycles(target);
      }
    }

    stack.pop();
  };

  walkCycles(resolvedJourney.initial);

  const terminalMemo = new Map<TStepId, boolean>();
  const canReachTerminal = (stepId: TStepId, pending = new Set<TStepId>()): boolean => {
    const memoized = terminalMemo.get(stepId);
    if (memoized !== undefined) {
      return memoized;
    }

    if (isImplicitlyTerminalStep(stepId)) {
      terminalMemo.set(stepId, true);
      return true;
    }

    if (pending.has(stepId)) {
      return false;
    }

    pending.add(stepId);
    const terminalReachable = getOutgoingTransitions(stepId).some((transition) => {
      const target = resolveTransitionTarget(transition);
      if (target === "COMPLETE" || target === "TERMINATED") {
        return true;
      }
      return canReachTerminal(target, pending);
    });
    pending.delete(stepId);
    terminalMemo.set(stepId, terminalReachable);
    return terminalReachable;
  };

  const terminalPathExists = canReachTerminal(resolvedJourney.initial);
  if (!terminalPathExists) {
    issues.push({
      code: "no-terminal-path",
      severity: "warning",
      stepId: resolvedJourney.initial,
      message: `No terminal path is reachable from the initial step "${resolvedJourney.initial}".`
    });
  }

  return {
    issues,
    summary: {
      mode,
      stepCount: stepIds.length,
      reachableStepCount: reachable.size,
      unreachableStepCount: stepIds.length - reachable.size,
      deadEndCount: issues.filter((issue) => issue.code === "dead-end-step").length,
      cycleCount: issues.filter((issue) => issue.code === "cycle-detected").length,
      duplicateTransitionIdCount: issues.filter((issue) => issue.code === "duplicate-transition-id")
        .length,
      shadowedTransitionCount: issues.filter((issue) => issue.code === "shadowed-transition")
        .length,
      graphChecksSkipped: false,
      terminalPathExists
    }
  };
}
/* eslint-enable no-redeclare */
