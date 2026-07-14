import type {
  AnyJourneyPlugin,
  JourneyEventObject,
  JourneySnapshot,
  NavigationResult,
  StepHookArgs
} from "./types";

/** Internal, kind-agnostic hook shapes (public typing lives in the creators). */
export type AnyHookArgs = StepHookArgs<unknown, string, JourneyEventObject>;
export type AnyOnLeave = (args: AnyHookArgs) => boolean | void | Promise<boolean | void>;
export type AnyOnEffect = (args: AnyHookArgs) => void | Promise<void>;

export type RuntimeStep = {
  readonly metadata: unknown;
  readonly onEnter?: AnyOnEffect;
  readonly onLeave?: AnyOnLeave;
};

export type RuntimeTransition = {
  readonly event: string;
  readonly from: string;
  readonly to: string;
  readonly when?: (args: { context: unknown; handlers: unknown }) => boolean;
  readonly onTransition?: AnyOnEffect;
};

export type RuntimeConfig = {
  readonly kind: "linear" | "graph";
  /** Declaration order (linear: the navigation order; graph: for totals only). */
  readonly stepIds: readonly string[];
  readonly steps: Readonly<Record<string, RuntimeStep>>;
  readonly initial: string;
  readonly initialContext: unknown;
  /** Graph only: flattened transitions map in declaration order. */
  readonly transitions: readonly RuntimeTransition[];
  readonly handlers: unknown;
  readonly autoStart: boolean;
  readonly defaultTimeoutMs: number | undefined;
  readonly plugins: readonly AnyJourneyPlugin[];
};

export type NavigationFailure = Extract<NavigationResult, { ok: false }>;

export type TimelineOp =
  | { readonly kind: "pointer"; readonly index: number }
  | { readonly kind: "append" };

export type TransitionListener = (info: {
  from: string | null;
  to: string;
  snapshot: JourneySnapshot;
}) => void;
