import { normalizeGraphDefinition } from "../../graph/graph";
import type { DiagnosticsIssue, DiagnosticsResult } from "./diagnostics.types";
import type { JourneyStructure } from "../../core/types";

/**
 * Structural analysis of a journey's transition graph: unreachable steps,
 * shadowed transitions (an earlier unguarded candidate on the same
 * `(from, event)` always wins), cycles, and terminal-path existence.
 * Completion is explicit in this model, so terminal steps are reported as
 * facts in the summary, not as dead-end issues.
 */
export function analyzeStructure(structure: JourneyStructure): DiagnosticsResult {
  const issues: DiagnosticsIssue[] = [];
  const stepIds = [...structure.stepIds];

  if (structure.kind !== "graph") {
    return {
      issues,
      summary: {
        kind: structure.kind,
        stepCount: stepIds.length,
        reachableStepCount: stepIds.length,
        unreachableStepCount: 0,
        terminalStepIds: [],
        cycleCount: 0,
        shadowedTransitionCount: 0,
        terminalPathExists: false,
        graphChecksSkipped: true
      }
    };
  }

  // Shadowed transitions: after an unguarded candidate for (from, event),
  // later candidates for the same key can never be selected.
  const shadowedIndexes = new Set<number>();
  const unguardedSeen = new Set<string>();
  structure.transitions.forEach((transition, index) => {
    const key = `${transition.from} ${transition.event}`;
    if (unguardedSeen.has(key)) {
      shadowedIndexes.add(index);
      issues.push({
        code: "shadowed-transition",
        severity: "warning",
        from: transition.from,
        event: transition.event,
        message: `Transition "${transition.from}.${transition.event}" is shadowed by an earlier unconditional candidate.`
      });
      return;
    }
    if (!transition.guarded) unguardedSeen.add(key);
  });

  const activeTransitions = structure.transitions.filter((_, index) => !shadowedIndexes.has(index));
  const outgoing = (stepId: string) =>
    activeTransitions.filter((transition) => transition.from === stepId);

  const reachable = new Set<string>();
  const queue = [structure.initial];
  while (queue.length > 0) {
    const stepId = queue.pop() as string;
    if (reachable.has(stepId)) continue;
    reachable.add(stepId);
    for (const transition of outgoing(stepId)) queue.push(transition.to);
  }

  for (const stepId of stepIds) {
    if (reachable.has(stepId)) continue;
    issues.push({
      code: "unreachable-step",
      severity: "warning",
      stepId,
      message: `Step "${stepId}" is unreachable from the initial step "${structure.initial}".`
    });
  }

  const terminalStepIds = stepIds.filter((stepId) => outgoing(stepId).length === 0);

  // Cycle detection over the reachable subgraph.
  const cycleKeys = new Set<string>();
  const visited = new Set<string>();
  const stack: string[] = [];
  const walk = (stepId: string) => {
    visited.add(stepId);
    stack.push(stepId);
    for (const transition of outgoing(stepId)) {
      const stackIndex = stack.indexOf(transition.to);
      if (stackIndex >= 0) {
        const cycleSteps = [...stack.slice(stackIndex), transition.to];
        const cycleKey = cycleSteps.join(" ");
        if (!cycleKeys.has(cycleKey)) {
          cycleKeys.add(cycleKey);
          issues.push({
            code: "cycle-detected",
            severity: "warning",
            from: transition.from,
            event: transition.event,
            steps: cycleSteps,
            message: `Cycle detected: ${cycleSteps.join(" -> ")}.`
          });
        }
        continue;
      }
      if (!visited.has(transition.to)) walk(transition.to);
    }
    stack.pop();
  };
  walk(structure.initial);

  const terminalPathExists = terminalStepIds.some((stepId) => reachable.has(stepId));
  if (!terminalPathExists) {
    issues.push({
      code: "no-terminal-path",
      severity: "warning",
      stepId: structure.initial,
      message: `No terminal step is reachable from the initial step "${structure.initial}".`
    });
  }

  return {
    issues,
    summary: {
      kind: structure.kind,
      stepCount: stepIds.length,
      reachableStepCount: reachable.size,
      unreachableStepCount: stepIds.length - reachable.size,
      terminalStepIds,
      cycleCount: cycleKeys.size,
      shadowedTransitionCount: shadowedIndexes.size,
      terminalPathExists,
      graphChecksSkipped: false
    }
  };
}

/** Analyzes a graph journey definition without creating a runtime. */
export function getGraphDiagnostics(definition: {
  readonly steps: object;
  readonly transitions: object;
  readonly initial: string;
}): DiagnosticsResult {
  const { stepIds, transitions } = normalizeGraphDefinition(
    definition as Parameters<typeof normalizeGraphDefinition>[0]
  );
  const structure: JourneyStructure = {
    kind: "graph",
    stepIds,
    initial: definition.initial,
    transitions: transitions.map((transition) => ({
      event: transition.event,
      from: transition.from,
      to: transition.to,
      guarded: transition.when !== undefined
    }))
  };
  return analyzeStructure(structure);
}
