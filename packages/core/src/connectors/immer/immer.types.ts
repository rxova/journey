import type { Producer } from "immer";

/**
 * Synchronous Immer recipe adapted into a Journey context updater.
 *
 * A recipe may mutate its draft or return a replacement context, following
 * Immer's producer rules. Returning `undefined` without draft mutations is a
 * no-op; use Immer's `nothing` sentinel when an undefined context is intended.
 */
export type ImmerContextRecipe<TContext> = Producer<TContext>;
