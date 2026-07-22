import type { GraphHookArgs, GraphJourneyDefinition } from "./graph.types";
import type { GraphSnapshot, JourneyEventObject, OnEnterHook, OnLeaveHook } from "../core/types";

/**
 * One declaration point for a journey's types — steps can then be authored in
 * separate files without threading generics through each one.
 */
export type JourneyTypeBag = {
  context: unknown;
  stepId: string;
  events: JourneyEventObject;
  meta?: unknown;
  handlers?: unknown;
};

/**
 * `meta` and `handlers` are optional on the bag, so these must infer from an
 * optional property. Matching `{ meta: infer T }` — a *required* property —
 * silently skipped anyone who mirrored the constraint and wrote `meta?: MyMeta`:
 * they got the fallback instead of their own type, and the eventual error
 * pointed nowhere near the bag declaration. `NonNullable` strips the `undefined`
 * that optionality adds.
 */
export type MetaOf<TBag extends JourneyTypeBag> = TBag extends { meta?: infer TMeta }
  ? [TMeta] extends [undefined]
    ? Record<string, unknown>
    : NonNullable<TMeta>
  : Record<string, unknown>;

export type HandlersOf<TBag extends JourneyTypeBag> = TBag extends { handlers?: infer THandlers }
  ? [THandlers] extends [undefined]
    ? Record<string, never>
    : NonNullable<THandlers>
  : Record<string, never>;

export type BagSnapshot<TBag extends JourneyTypeBag> = GraphSnapshot<
  TBag["context"],
  TBag["stepId"],
  MetaOf<TBag>,
  TBag["events"]
>;

/** What every guard sees; work-scoped candidates extend this with `result`. */
export type GuardArgsOf<TBag extends JourneyTypeBag> = {
  readonly context: TBag["context"];
  readonly handlers: HandlersOf<TBag>;
};

/**
 * Guard args for a candidate declared inside `work(...)`: the run result rides
 * along, so transient outcomes can route without being persisted in context.
 * `result` is only populated while routing that work's send — during snapshot
 * introspection (`outgoingTransitions`) the same guard sees it as undefined.
 */
export type WorkGuardArgs<TBag extends JourneyTypeBag, TResult> = GuardArgsOf<TBag> & {
  readonly result: TResult;
};

/** Chainable transition candidate under construction (no `from` yet). */
export type JourneyToBuilder<
  TBag extends JourneyTypeBag,
  TType extends TBag["events"]["type"],
  TGuardArgs extends GuardArgsOf<TBag> = GuardArgsOf<TBag>
> = {
  readonly _candidate: {
    readonly to: TBag["stepId"];
    readonly when?: (args: TGuardArgs) => boolean;
    readonly onTransition?: (
      args: GraphHookArgs<TBag["context"], TBag["stepId"], TBag["events"], MetaOf<TBag>>
    ) => void | Promise<void>;
  };
  when(guard: (args: TGuardArgs) => boolean): JourneyToBuilder<TBag, TType, TGuardArgs>;
  onTransition(
    effect: (
      args: GraphHookArgs<
        TBag["context"],
        TBag["stepId"],
        Extract<TBag["events"], { type: TType }>,
        MetaOf<TBag>
      >
    ) => void | Promise<void>
  ): JourneyToBuilder<TBag, TType, TGuardArgs>;
};

export type ToFactory<
  TBag extends JourneyTypeBag,
  TType extends TBag["events"]["type"],
  TGuardArgs extends GuardArgsOf<TBag> = GuardArgsOf<TBag>
> = (target: TBag["stepId"]) => JourneyToBuilder<TBag, TType, TGuardArgs>;

/**
 * Unguarded candidate pointing back at the declaring step — the named form of
 * the totality fallback: "on any other outcome, keep the staged context and
 * remain here". Chainable like any candidate, but the unguarded default is the
 * point.
 */
export type StayFactory<
  TBag extends JourneyTypeBag,
  TType extends TBag["events"]["type"],
  TGuardArgs extends GuardArgsOf<TBag> = GuardArgsOf<TBag>
> = () => JourneyToBuilder<TBag, TType, TGuardArgs>;

/** Event-scoped work args: no `to`, since routing has not happened yet. */
export type BagSendWorkArgs<TBag extends JourneyTypeBag, TType extends TBag["events"]["type"]> = {
  readonly snapshot: BagSnapshot<TBag>;
  readonly from: TBag["stepId"];
  readonly event: Extract<TBag["events"], { type: TType }>;
  readonly handlers: HandlersOf<TBag>;
};

/** Work-scoped candidate helpers: `to`/`stay` whose guards also see `result`. */
export type WorkCandidateHelpers<
  TBag extends JourneyTypeBag,
  TType extends TBag["events"]["type"],
  TResult
> = {
  readonly to: ToFactory<TBag, TType, WorkGuardArgs<TBag, TResult>>;
  readonly stay: StayFactory<TBag, TType, WorkGuardArgs<TBag, TResult>>;
};

/** An event's declared work plus the candidates its staged context routes into. */
export type JourneyEventWork<TBag extends JourneyTypeBag, TType extends TBag["events"]["type"]> = {
  readonly _work: {
    readonly run: (args: BagSendWorkArgs<TBag, TType>) => unknown;
    readonly commit?: (args: never) => void;
    readonly allowRollback?: boolean;
  };
  readonly candidates:
    | readonly JourneyToBuilder<TBag, TType>[]
    | ((
        helpers: WorkCandidateHelpers<TBag, TType, unknown>
      ) => readonly JourneyToBuilder<TBag, TType, WorkGuardArgs<TBag, unknown>>[]);
};

/**
 * Declares async that runs before the guards choose an edge. `commit` stages
 * context, and the candidates are evaluated against that staged context — so
 * the definition owns the async without guards becoming async.
 */
export type WorkFactory<TBag extends JourneyTypeBag, TType extends TBag["events"]["type"]> = <
  TResult
>(config: {
  readonly run: (args: BagSendWorkArgs<TBag, TType>) => TResult | Promise<TResult>;
  readonly commit?: (
    args: BagSendWorkArgs<TBag, TType> & {
      readonly result: TResult;
      readonly updateContext: (updater: (previous: TBag["context"]) => TBag["context"]) => void;
    }
  ) => void;
  /**
   * Array form: candidates share the event scope's `to` (guards see context
   * and handlers). Callback form: a work-scoped `to`/`stay` whose guards also
   * receive the typed run `result`.
   */
  readonly candidates:
    | readonly JourneyToBuilder<TBag, TType>[]
    | ((
        helpers: WorkCandidateHelpers<TBag, TType, TResult>
      ) => readonly JourneyToBuilder<TBag, TType, WorkGuardArgs<TBag, TResult>>[]);
  /**
   * Declares an intentionally partial event: silences the build-time totality
   * warning that fires when every candidate is guarded (meaning a no-match
   * send rolls its staged context back).
   */
  readonly allowRollback?: boolean;
}) => JourneyEventWork<TBag, TType>;

/**
 * Per-event candidates: an array, or a callback receiving an event-scoped `to`
 * so `onTransition` sees the narrowed event payload. The callback may instead
 * return `work({ run, commit, candidates })` to let the machine own the async.
 */
export type JourneyStepTransitions<TBag extends JourneyTypeBag> = {
  readonly [TType in TBag["events"]["type"]]?:  // array form: wide event type; the callback form's scoped `to` narrows it
    | readonly JourneyToBuilder<TBag, TBag["events"]["type"]>[]
    | ((helpers: {
        to: ToFactory<TBag, TType>;
        work: WorkFactory<TBag, TType>;
        stay: StayFactory<TBag, TType>;
      }) => readonly JourneyToBuilder<TBag, TType>[] | JourneyEventWork<TBag, TType>);
};

export type JourneyStepBuilder<
  TBag extends JourneyTypeBag,
  TStepId extends TBag["stepId"] = TBag["stepId"]
> = {
  readonly id: TStepId;
  readonly _config: {
    readonly metadata?: MetaOf<TBag>;
    readonly onEnter?: OnEnterHook<
      TBag["context"],
      TBag["stepId"],
      TBag["events"],
      BagSnapshot<TBag>
    >;
    readonly onLeave?: OnLeaveHook<
      TBag["context"],
      TBag["stepId"],
      TBag["events"],
      BagSnapshot<TBag>
    >;
    readonly on?: JourneyStepTransitions<TBag>;
  };
};

export type JourneyBuilder<TBag extends JourneyTypeBag> = {
  createStep<TStepId extends TBag["stepId"]>(
    id: TStepId,
    config?: JourneyStepBuilder<TBag, TStepId>["_config"]
  ): JourneyStepBuilder<TBag, TStepId>;
  to: ToFactory<TBag, TBag["events"]["type"]>;
  build(input: {
    initial: TBag["stepId"];
    context: TBag["context"];
    handlers?: HandlersOf<TBag>;
    steps: readonly JourneyStepBuilder<TBag>[];
  }): GraphJourneyDefinition<
    TBag["context"],
    TBag["stepId"],
    TBag["events"],
    HandlersOf<TBag>,
    MetaOf<TBag>
  >;
};
