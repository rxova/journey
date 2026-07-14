import type {
  JourneyDefinition,
  JourneyJsonObject,
  JourneyStepDefinition,
  LinearJourneyDefinition
} from "./types";
import type { JourneyEmpty } from "./types";
import type { JourneyGraphEdge, JourneyTransitionGraph } from "./types";

/**
 * Converts a linear journey definition into the equivalent authorable graph
 * definition: the same steps record (carrying meta/lifecycle/effect/after) plus
 * a forward `goToNextStep` chain between adjacent steps. Step ids are preserved
 * verbatim, so persisted state remains valid across the migration (see
 * {@link toGraphSnapshot} for converting stored snapshots).
 *
 * The last step deliberately has no `goToNextStep` edge — the machine's
 * implicit-completion fallback (`goToNextStep` on a step with no declared
 * transition completes the journey unless `requireExplicitCompletion` is set)
 * behaves identically in graph mode, so the linear semantics carry over.
 *
 * Backward navigation needs no edges: `goToPreviousStep` is history-based in
 * every mode.
 */
export function toGraphDefinition<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TStepMeta = unknown,
  THandlers extends Record<string, unknown> = JourneyEmpty
>(
  linear: LinearJourneyDefinition<TContext, TStepId, TStepMeta, THandlers>
): JourneyDefinition<TContext, TStepId, never, TStepMeta, THandlers> {
  const stepOrder = linear.steps.map((entry) =>
    typeof entry === "string" ? entry : entry.id
  ) as readonly TStepId[];

  const steps = Object.fromEntries(
    linear.steps.map((entry) => {
      if (typeof entry === "string") {
        return [entry, {}];
      }
      const { id, meta, onEnter, onLeave, effect, after } = entry;
      return [
        id,
        {
          ...(meta !== undefined ? { meta } : {}),
          ...(onEnter !== undefined ? { onEnter } : {}),
          ...(onLeave !== undefined ? { onLeave } : {}),
          ...(effect !== undefined ? { effect } : {}),
          ...(after !== undefined ? { after } : {})
        }
      ];
    })
  ) as Record<TStepId, JourneyStepDefinition<TContext, TStepId, never, TStepMeta, THandlers>>;

  const transitions = {} as JourneyTransitionGraph<TContext, TStepId, never, THandlers>;
  for (let index = 0; index < stepOrder.length - 1; index += 1) {
    const from = stepOrder[index] as TStepId;
    const to = stepOrder[index + 1] as TStepId;
    (transitions as Record<string, unknown>)[from] = {
      goToNextStep: [
        { to } as JourneyGraphEdge<TContext, TStepId, never, THandlers, "goToNextStep">
      ]
    };
  }

  return {
    initial: stepOrder[0] as TStepId,
    context: linear.context,
    ...(linear.handlers !== undefined ? { handlers: linear.handlers } : {}),
    steps,
    transitions
  };
}

/**
 * Converts a linear snapshot (live or persisted state) into its graph-family
 * equivalent: flips the `type` discriminator to `"graph"` and drops
 * `stepOrder`, keeping every base field verbatim. Because step ids are stable
 * across {@link toGraphDefinition}, `currentStepId`, `history.timeline`, and
 * `visited` remain valid — feed the result through the graph machine's
 * `initialSnapshot` option or a persistence `migrate` step.
 */
export function toGraphSnapshot<
  TSnapshot extends {
    type: "linear";
    stepOrder: readonly string[];
    visits?: Record<string, number>;
  }
>(snapshot: TSnapshot): Omit<TSnapshot, "type" | "stepOrder" | "visits"> & { type: "graph" } {
  const rest = { ...snapshot } as Partial<TSnapshot>;
  delete rest.type;
  delete rest.stepOrder;
  delete rest.visits;
  return { ...rest, type: "graph" as const } as Omit<TSnapshot, "type" | "stepOrder" | "visits"> & {
    type: "graph";
  };
}
