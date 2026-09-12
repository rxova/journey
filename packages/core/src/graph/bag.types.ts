import type { GraphOnEntry, GraphStepConfig, GraphJourneyDefinition } from "./graph.types";
import type { JourneyEventObject } from "../core/types";

/**
 * One declaration point for a journey's types.
 *
 * Two things need it. Steps authored in separate files have to name the shape
 * they satisfy, and `withTypes` needs somewhere to pin types that the
 * definition cannot infer on its own. Everything except `context`, `stepId`
 * and `events` is optional and falls back.
 */
export type Bag = {
  context: unknown;
  stepId: string;
  events: JourneyEventObject;
  meta?: unknown;
  handlers?: unknown;
  /**
   * Result type per event name, for events declaring `run`.
   *
   * Load-bearing rather than a convenience: a declared `run` sits at a property
   * position, which is not an inference site, so `commit`'s `result` is
   * `unknown` unless it is pinned here. One result type per event name — not
   * per (step, event) pair.
   */
  results?: Record<string, unknown>;
};

/**
 * `meta`, `handlers` and `results` are optional on the bag, so these must infer
 * from an optional property. Matching `{ meta: infer T }` — a *required*
 * property — silently skipped anyone who mirrored the constraint and wrote
 * `meta?: MyMeta`: they got the fallback instead of their own type, and the
 * eventual error pointed nowhere near the bag declaration. `NonNullable` strips
 * the `undefined` that optionality adds.
 */
export type MetaOf<TBag extends Bag> = TBag extends { meta?: infer TMeta }
  ? [TMeta] extends [undefined]
    ? Record<string, unknown>
    : NonNullable<TMeta>
  : Record<string, unknown>;

export type HandlersOf<TBag extends Bag> = TBag extends { handlers?: infer THandlers }
  ? [THandlers] extends [undefined]
    ? Record<string, never>
    : NonNullable<THandlers>
  : Record<string, never>;

export type ResultsOf<TBag extends Bag> = TBag extends { results?: infer TResults }
  ? [TResults] extends [undefined]
    ? Record<string, never>
    : NonNullable<TResults>
  : Record<string, never>;

/**
 * The declared result for one event, or `unknown` when the bag pins none.
 *
 * The empty-default check comes first and is load-bearing: `ResultsOf` falls
 * back to `Record<string, never>`, whose `keyof` is `string`, so without it
 * every event name "matches" and resolves to `never` — which rejects every
 * `run` rather than accepting any.
 */
export type ResultOf<TBag extends Bag, TType extends string> = [ResultsOf<TBag>] extends [
  Record<string, never>
]
  ? unknown
  : TType extends keyof ResultsOf<TBag>
    ? ResultsOf<TBag>[TType]
    : unknown;

/**
 * One step's config for a pinned bag — what a step authored in its own file
 * annotates itself with.
 *
 * ```ts
 * export const loginStep: GraphStep<AuthBag> = {
 *   metadata: { label: "Login" },
 *   on: { submit: "twofa" }
 * };
 * ```
 */
export type GraphStep<TBag extends Bag> = Omit<
  GraphStepConfig<TBag["context"], TBag["stepId"], TBag["events"], MetaOf<TBag>, HandlersOf<TBag>>,
  "on"
> & {
  readonly on?: {
    readonly [TType in TBag["events"]["type"]]?: GraphOnEntry<
      TBag["context"],
      TBag["stepId"],
      TBag["events"],
      HandlersOf<TBag>,
      MetaOf<TBag>,
      ResultOf<TBag, TType>,
      Extract<TBag["events"], { type: TType }>
    >;
  };
};

/**
 * A whole graph definition for a pinned bag, for the case `withTypes` cannot
 * express: a standalone definition passed to the factory more than once, with
 * different options each time.
 *
 * ```ts
 * export const definition = {
 *   initial: "login",
 *   context: initialContext,
 *   steps: { login: { on: { submit: "twofa" } }, twofa: {} }
 * } satisfies GraphDefinition<AuthBag>;
 * ```
 */
export type GraphDefinition<TBag extends Bag> = {
  readonly initial: TBag["stepId"];
  readonly context: TBag["context"];
  readonly handlers?: HandlersOf<TBag>;
  readonly steps: Readonly<Record<TBag["stepId"], GraphStep<TBag>>>;
};

/** The definition shape `withTypes` accepts, and what `GraphDefinition` widens to. */
export type BagGraphDefinition<TBag extends Bag> = GraphJourneyDefinition<
  TBag["context"],
  TBag["stepId"],
  TBag["events"],
  HandlersOf<TBag>,
  MetaOf<TBag>
>;
