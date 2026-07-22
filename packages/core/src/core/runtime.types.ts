import type {
  AnyJourneyPlugin,
  ContextUpdater,
  JourneyEventObject,
  JourneySnapshot,
  NavigationDirection,
  NavigationWork,
  NavigationResult,
  StepHookArgs
} from "./types";

/** Internal, kind-agnostic hook shapes (public typing lives in the creators). */
export type AnyHookArgs = StepHookArgs<unknown, string, JourneyEventObject>;
export type AnyOnEffect = (args: AnyHookArgs) => void | Promise<void>;
export type AnyNavigationWork = NavigationWork<unknown, string, JourneySnapshot, unknown>;

/**
 * Send work runs before routing, so unlike navigation work it has no `to` or
 * `direction` to report — the target is not chosen yet. It carries the event
 * that triggered it and the machine's handlers instead.
 */
export type AnySendWorkArgs = {
  readonly snapshot: JourneySnapshot;
  readonly from: string;
  readonly event: JourneyEventObject;
  readonly handlers: unknown;
};

export type AnySendWork = {
  readonly run: (args: AnySendWorkArgs) => unknown;
  readonly commit?: (
    args: AnySendWorkArgs & {
      readonly result: unknown;
      readonly updateContext: (updater: ContextUpdater<unknown>) => void;
    }
  ) => unknown;
};

export type RuntimeStep = {
  readonly metadata: unknown;
  readonly onEnter?: AnyOnEffect;
  readonly onLeave?: AnyOnEffect;
};

export type RuntimeTransition = {
  readonly event: string;
  readonly from: string;
  readonly to: string;
  /**
   * `result` is the run result while routing a work send, and undefined
   * everywhere else (plain sends, snapshot introspection).
   */
  readonly when?: (args: { context: unknown; handlers: unknown; result?: unknown }) => boolean;
  readonly onTransition?: AnyOnEffect;
};

export type RuntimeConfig = {
  readonly kind: "linear" | "graph";
  /** Declaration order (linear: the navigation order; graph: for totals only). */
  readonly stepIds: readonly string[];
  readonly steps: Readonly<Record<string, RuntimeStep>>;
  readonly initial: string;
  /** Overrides `initial` for the entry on start()/restart(). */
  readonly startAt?: string;
  readonly initialContext: unknown;
  /** Graph only: flattened transitions map in declaration order. */
  readonly transitions: readonly RuntimeTransition[];
  /**
   * Graph only: work declared on an event in the definition, keyed by
   * {@link eventWorkKey} — two steps may declare different work for the same
   * event name, so the origin step is part of the key.
   */
  readonly eventWork?: Readonly<Record<string, AnySendWork>>;
  readonly handlers: unknown;
  readonly autoStart: boolean;
  readonly defaultTimeoutMs: number | undefined;
  /** Routes isolated subscriber failures; defaults to the console reporter. */
  readonly onListenerError?: (error: unknown) => void;
  /**
   * Seeds the first `start()` from a persisted record instead of a fresh
   * entry at `startAt ?? initial`. Consumed once — `restart()` always goes
   * fresh. Factories only pass a record that validated against the definition.
   */
  readonly restore?: {
    readonly context: unknown;
    readonly timeline: readonly string[];
    readonly currentIndex: number;
  };
  readonly plugins: readonly AnyJourneyPlugin[];
};

export type NavigationFailure = Extract<NavigationResult, { ok: false }>;

export type TimelineOp =
  | { readonly kind: "pointer"; readonly index: number }
  | { readonly kind: "append" };

export type WorkDirection = NavigationDirection;

export type TransitionListener = (info: {
  from: string | null;
  to: string;
  snapshot: JourneySnapshot;
}) => void;
