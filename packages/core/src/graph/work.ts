import type { Bag, HandlersOf, MetaOf, ResultOf } from "./bag.types";
import type { GraphOnEntry, GraphTransition, SendWorkArgs } from "./graph.types";
import type { ContextUpdater, GraphSnapshot } from "../core/types";

/** The event an entry is declared under, narrowed out of the bag's union. */
type TriggerOf<TBag extends Bag, TType extends TBag["events"]["type"]> = Extract<
  TBag["events"],
  { type: TType }
>;

type WorkArgs<TBag extends Bag, TType extends TBag["events"]["type"]> = SendWorkArgs<
  TBag["stepId"],
  TriggerOf<TBag, TType>,
  GraphSnapshot<TBag["context"], TBag["stepId"], MetaOf<TBag>, TBag["events"]>,
  HandlersOf<TBag>
>;

/**
 * The config {@link defineWork} checks.
 *
 * The same shape as the object arm of {@link GraphOnEntry}, with two
 * differences that only a function call can provide: `TResult` is a free type
 * parameter here rather than a fixed argument, and `event` is narrowed to the
 * key the entry is declared under.
 */
export type WorkConfig<TBag extends Bag, TType extends TBag["events"]["type"], TResult> = {
  readonly run: (args: WorkArgs<TBag, TType>) => TResult | Promise<TResult>;
  readonly commit?: (
    args: WorkArgs<TBag, TType> & {
      readonly result: TResult;
      readonly updateContext: (updater: ContextUpdater<TBag["context"]>) => void;
    }
  ) => void;
  /** Names this work in timeout and error messages. */
  readonly label?: string;
  /** Budget for `run`, overriding `defaultTimeoutMs`. */
  readonly timeoutMs?: number;
  /**
   * Guards here stay total functions of context, as everywhere else: the run
   * result reaches them only through the context `commit` stages. Routing
   * directly on the result was removed in v2 because the same guards run during
   * snapshot derivation, where no send is in flight — `availableEvents` would
   * then disagree with what a send actually does.
   */
  readonly candidates: readonly GraphTransition<
    TBag["context"],
    TBag["stepId"],
    TBag["events"],
    HandlersOf<TBag>,
    MetaOf<TBag>,
    TriggerOf<TBag, TType>
  >[];
};

/**
 * Declares an event's async so that `run`'s return type flows into `commit` and
 * into the candidates' guards.
 *
 * Written straight into a definition, `run` sits at a property position, which
 * is not an inference site — so `result` is `unknown` unless the type is
 * restated in the bag's `results`. Pinning it there works, but it is a second
 * place to keep in sync, and it is one result type per event name rather than
 * per (step, event) pair. Passing the same config through a generic function
 * call puts `TResult` back at an inference site, so it is read off `run` and
 * nothing needs restating:
 *
 * ```ts
 * on: {
 *   SUBMIT: defineWork<AuthBag, "SUBMIT">()({
 *     run: ({ handlers }) => handlers.login(),   // TResult inferred here
 *     commit: ({ result, updateContext }) =>     // ...and typed here
 *       updateContext((c) => ({ ...c, token: result.token })),
 *     timeoutMs: 10_000,
 *     candidates: [
 *       { to: "twofa", label: "needs-2fa", when: ({ result }) => result?.twoFactor === true },
 *       { to: "home", label: "logged-in" }
 *     ]
 *   })
 * }
 * ```
 *
 * The call is curried because TypeScript infers all of a call's type arguments
 * or none: naming the bag and the event inline would opt `TResult` out of
 * inference too, which is the problem being solved. The empty second call is
 * the price of pinning the first two and inferring the third.
 *
 * Pairs with a bag, so reach for it through `withGraphTypes<TBag>()` rather
 * than plain `createGraphJourney`: the bag is where `stepId`, `events` and
 * `handlers` come from, and a definition that infers those itself will not line
 * up with them.
 *
 * At runtime this returns its argument unchanged. The cast is what erases the
 * narrowed `event` and the inferred `TResult` back down to the slot's wider
 * shape — a guard's `result` sits at a contravariant position, so a pinned
 * config cannot be assigned into an `unknown` slot directly. That is the same
 * erasure the v1 builder did, and it is sound because the config has already
 * been checked, against sharper types, at this call site.
 */
export const defineWork =
  <TBag extends Bag, TType extends TBag["events"]["type"] = TBag["events"]["type"]>() =>
  <TResult>(
    config: WorkConfig<TBag, TType, TResult>
  ): GraphOnEntry<
    TBag["context"],
    TBag["stepId"],
    TBag["events"],
    HandlersOf<TBag>,
    MetaOf<TBag>,
    ResultOf<TBag, TType>,
    TriggerOf<TBag, TType>
  > =>
    config as unknown as GraphOnEntry<
      TBag["context"],
      TBag["stepId"],
      TBag["events"],
      HandlersOf<TBag>,
      MetaOf<TBag>,
      ResultOf<TBag, TType>,
      TriggerOf<TBag, TType>
    >;
