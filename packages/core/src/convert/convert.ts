import { JourneyError } from "../core/errors";
import type { LinearToGraphOptions } from "./convert.types";
import type {
  GraphJourneyDefinition,
  GraphStepConfig,
  GraphTransitionCandidate
} from "../graph/graph.types";
import type {
  JourneyTerminationPayloads,
  LinearJourneyDefinition,
  LinearStepConfig
} from "../linear/linear.types";

export type { LinearToGraphOptions } from "./convert.types";

/**
 * Definition transformer: converts a pure-data linear definition into the
 * equivalent graph definition. Declared order becomes `NEXT`/`PREVIOUS`
 * events with one candidate per adjacent pair; `initial` is the first step;
 * hooks, metadata, and context carry over unchanged.
 */
export function linearToGraphDefinition<TContext, TMeta = Record<string, unknown>>(
  definition: LinearJourneyDefinition<string, TContext, JourneyTerminationPayloads, TMeta>,
  options: LinearToGraphOptions = {}
): GraphJourneyDefinition<TContext, string, { type: string }, unknown, TMeta> {
  if (definition.steps.length === 0) {
    throw new JourneyError("empty-definition", "a linear journey needs at least one step");
  }

  const normalized: LinearStepConfig<TContext, string, TMeta>[] = definition.steps.map((input) =>
    typeof input === "string" ? { id: input } : input
  );
  const ids = normalized.map((step) => step.id);

  const steps: Record<string, GraphStepConfig> = {};
  for (const step of normalized) {
    const config: {
      metadata: Record<string, unknown>;
      onEnter?: NonNullable<GraphStepConfig["onEnter"]>;
      onLeave?: NonNullable<GraphStepConfig["onLeave"]>;
    } = { metadata: (step.metadata ?? {}) as Record<string, unknown> };
    if (step.onEnter) {
      config.onEnter = step.onEnter as unknown as NonNullable<GraphStepConfig["onEnter"]>;
    }
    if (step.onLeave) {
      config.onLeave = step.onLeave as unknown as NonNullable<GraphStepConfig["onLeave"]>;
    }
    steps[step.id] = config;
  }

  const transitions: Record<string, GraphTransitionCandidate[]> = {};
  const next: GraphTransitionCandidate[] = [];
  const previous: GraphTransitionCandidate[] = [];
  for (let index = 0; index < ids.length - 1; index += 1) {
    next.push({ from: ids[index] as string, to: ids[index + 1] as string });
    previous.push({ from: ids[index + 1] as string, to: ids[index] as string });
  }
  if (next.length > 0) transitions.NEXT = next;
  if (previous.length > 0) transitions.PREVIOUS = previous;

  if (options.includeJumpEvents) {
    for (const target of ids) {
      const jumps: GraphTransitionCandidate[] = ids
        .filter((id) => id !== target)
        .map((from) => ({ from, to: target }));
      if (jumps.length > 0) transitions[`GO_TO_${target}`] = jumps;
    }
  }

  return {
    steps,
    transitions,
    initial: ids[0] as string,
    context: definition.context
  } as GraphJourneyDefinition<TContext, string, { type: string }, unknown, TMeta>;
}
