import type { GraphHookArgs, GraphJourneyDefinition, TransitionGuard } from "./graph.types";
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

export type MetaOf<TBag extends JourneyTypeBag> = TBag extends { meta: infer TMeta }
  ? TMeta
  : Record<string, unknown>;

export type HandlersOf<TBag extends JourneyTypeBag> = TBag extends { handlers: infer THandlers }
  ? THandlers
  : Record<string, never>;

export type BagSnapshot<TBag extends JourneyTypeBag> = GraphSnapshot<
  TBag["context"],
  TBag["stepId"],
  MetaOf<TBag>,
  TBag["events"]
>;

/** Chainable transition candidate under construction (no `from` yet). */
export type JourneyToBuilder<TBag extends JourneyTypeBag, TType extends TBag["events"]["type"]> = {
  readonly _candidate: {
    readonly to: TBag["stepId"];
    readonly when?: TransitionGuard<TBag["context"], HandlersOf<TBag>>;
    readonly onTransition?: (
      args: GraphHookArgs<TBag["context"], TBag["stepId"], TBag["events"], MetaOf<TBag>>
    ) => void | Promise<void>;
  };
  when(guard: TransitionGuard<TBag["context"], HandlersOf<TBag>>): JourneyToBuilder<TBag, TType>;
  onTransition(
    effect: (
      args: GraphHookArgs<
        TBag["context"],
        TBag["stepId"],
        Extract<TBag["events"], { type: TType }>,
        MetaOf<TBag>
      >
    ) => void | Promise<void>
  ): JourneyToBuilder<TBag, TType>;
};

export type ToFactory<TBag extends JourneyTypeBag, TType extends TBag["events"]["type"]> = (
  target: TBag["stepId"]
) => JourneyToBuilder<TBag, TType>;

/** Event-scoped work args: no `to`, since routing has not happened yet. */
export type BagSendWorkArgs<TBag extends JourneyTypeBag, TType extends TBag["events"]["type"]> = {
  readonly snapshot: BagSnapshot<TBag>;
  readonly from: TBag["stepId"];
  readonly event: Extract<TBag["events"], { type: TType }>;
  readonly handlers: HandlersOf<TBag>;
};

/** An event's declared work plus the candidates its staged context routes into. */
export type JourneyEventWork<TBag extends JourneyTypeBag, TType extends TBag["events"]["type"]> = {
  readonly _work: {
    readonly run: (args: BagSendWorkArgs<TBag, TType>) => unknown;
    readonly commit?: (args: never) => void;
  };
  readonly candidates: readonly JourneyToBuilder<TBag, TType>[];
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
  readonly candidates: readonly JourneyToBuilder<TBag, TType>[];
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
