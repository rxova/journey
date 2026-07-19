import type React from "react";
import type {
  AnyJourneyPlugin,
  JourneyEventPayloads,
  JourneyPersistOption,
  LinearJourneyMachine as CoreLinearJourneyMachine,
  LinearSnapshot,
  NavigationWork,
  OnEnterHook,
  OnLeaveHook
} from "@rxova/journey-core";

/** A linear journey's underlying core machine, verbatim. */
export type LinearJourneyMachine<
  TContext = unknown,
  TStepId extends string = string
> = CoreLinearJourneyMachine<TContext, TStepId>;

/**
 * A linear journey's core snapshot, verbatim — with one type-level narrowing:
 * `currentStep` is non-null. The React tier always creates its machine with
 * `autoStart`, and the initial entry commits synchronously inside creation, so
 * a rendered journey never observes the idle (null) state.
 */
export type LinearJourneySnapshot<TContext = unknown, TStepId extends string = string> = Omit<
  LinearSnapshot<TContext, TStepId, unknown>,
  "currentStep"
> & {
  readonly currentStep: NonNullable<LinearSnapshot<TContext, TStepId, unknown>["currentStep"]>;
};

/** Core event payloads bound to the linear snapshot; callback props receive these verbatim. */
export type LinearJourneyEventPayloads<
  TContext = unknown,
  TStepId extends string = string
> = JourneyEventPayloads<TContext, TStepId, LinearJourneySnapshot<TContext, TStepId>>;

/** Per-step configuration declared on a `<LinearJourney.Step>` wrapper. */
export type LinearJourneyStepConfig<TContext = unknown> = {
  metadata?: unknown;
  onEnter?: OnEnterHook<TContext, string, never, LinearJourneySnapshot<TContext>>;
  onLeave?: OnLeaveHook<TContext, string, never, LinearJourneySnapshot<TContext>>;
};

/** Transactional Core work registered for this step's forward navigation. */
export type LinearJourneyStepHandler<TContext = unknown, TResult = void> = NavigationWork<
  TContext,
  string,
  LinearJourneySnapshot<TContext>,
  TResult
>;

export type LinearJourneyProps<TContext = unknown, TStepId extends string = string> = {
  /**
   * The steps, one per child element, each with a mandatory unique `id`
   * (a `<LinearJourney.Step id>` wrapper, or an inline `id` prop on components
   * that declare one). The step list is
   * frozen at mount: changing the derived id list is a dev-mode error.
   */
  children: React.ReactNode;

  /** Initial shared state. Lives in the core machine, not in React. */
  context?: TContext;
  /** Zero-based index of the starting step (JSX-order sugar over `startAt`). Default 0. */
  startIndex?: number;
  /** Starting step id (core's `startAt`); wins over `startIndex` (dev-mode error if both are set). */
  startAt?: TStepId;

  /** Rendered above/below the active step, INSIDE the linear journey context — both may call useLinearJourney(). */
  header?: React.ReactNode;
  footer?: React.ReactNode;
  /** The active step is cloned into this element (e.g. an animation wrapper). */
  wrapper?: React.ReactElement<{ children?: React.ReactNode }>;
  /** Shown when no step can render (before start or after terminate). */
  fallback?: React.ReactNode;

  /** Fires once per mounted journey with the start snapshot. */
  onStart?: (snapshot: LinearJourneySnapshot<TContext, TStepId>) => void;
  /** Verbatim forward of core's `stepEnter` event (carries `direction`). */
  onStepEnter?: (payload: LinearJourneyEventPayloads<TContext, TStepId>["stepEnter"]) => void;
  /** Verbatim forward of core's `stepLeave` event. */
  onStepLeave?: (payload: LinearJourneyEventPayloads<TContext, TStepId>["stepLeave"]) => void;
  /** Core's `statusChange` event, forwarded only when the journey completes. */
  onComplete?: (payload: LinearJourneyEventPayloads<TContext, TStepId>["statusChange"]) => void;
  /** Verbatim forward of core's `error` event. */
  onError?: (payload: LinearJourneyEventPayloads<TContext, TStepId>["error"]) => void;

  /** Core's `persist` creation option, passed through verbatim. */
  persist?: JourneyPersistOption;
  plugins?: readonly AnyJourneyPlugin[];
  /** Imperative escape hatch to the underlying core machine. */
  machineRef?: React.Ref<LinearJourneyMachine<TContext, TStepId>>;
};

/** Props of the `<LinearJourney.Step>` config-only marker element. */
export type LinearJourneyStepProps<
  TContext = unknown,
  TStepId extends string = string
> = LinearJourneyStepConfig<TContext> & {
  id: TStepId;
  children: React.ReactNode;
};

/** Everything `useLinearJourney()` returns: the core machine and snapshot, verbatim. */
export type UseLinearJourneyResult<TContext = unknown, TStepId extends string = string> = {
  machine: LinearJourneyMachine<TContext, TStepId>;
  snapshot: LinearJourneySnapshot<TContext, TStepId>;
};
