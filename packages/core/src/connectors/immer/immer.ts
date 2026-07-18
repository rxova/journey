import { produce } from "immer";
import type { ContextUpdater } from "../../core/types";
import type { ImmerContextRecipe } from "./immer.types";

export type { ImmerContextRecipe } from "./immer.types";

/**
 * Converts a synchronous Immer recipe into a Journey context updater.
 *
 * Pass the result to `machine.context.update`, a hook's `updateContext`, or a
 * transactional work commit. Immer supplies structural sharing and applies its
 * normal draftability and auto-freezing behavior.
 */
export function immerConnector<TContext>(
  recipe: ImmerContextRecipe<TContext>
): ContextUpdater<TContext> {
  return (previous) => produce(previous, recipe);
}
