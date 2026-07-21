import type React from "react";
import type {
  AnyJourneyPlugin,
  JourneyEventPayloads,
  JourneyRuntimeOptions,
  LinearJourneyMachine as CoreLinearJourneyMachine,
  LinearSnapshot,
  LinearStepInput,
  NavigationWork
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

/** Transactional Core work registered for a step's forward navigation. */
export type LinearJourneyStepHandler<TContext = unknown, TResult = void> = NavigationWork<
  TContext,
  string,
  LinearJourneySnapshot<TContext>,
  TResult
>;

/**
 * The pure-data definition `createLinearJourney()` captures: core's own
 * `LinearJourneyDefinition` shape, so the same object can feed
 * `linearToGraphDefinition()` from `@rxova/journey-core/convert` when a
 * journey outgrows the linear tier. Step configs (`metadata`, `onEnter`,
 * `onLeave`) live here — never in JSX.
 */
export type LinearJourneyBundleDefinition<
  TContext,
  TSteps extends readonly LinearStepInput<TContext, unknown>[] = readonly [
    LinearStepInput<TContext, unknown>,
    ...LinearStepInput<TContext, unknown>[]
  ]
> = {
  /** Ordered steps — the machine's source of truth. A bare string is shorthand for `{ id }`. */
  readonly steps: TSteps;
  /** Initial shared state and the bundle's context type anchor. */
  readonly context: TContext;
};

/** Core's creation options, passed through verbatim and frozen per bundle. */
export type LinearJourneyBundleOptions<TStepId extends string = string> = JourneyRuntimeOptions<
  readonly AnyJourneyPlugin[],
  TStepId
>;

export type LinearProviderProps<TContext = unknown, TStepId extends string = string> = {
  /**
   * One child element per declared step, in definition order — either a
   * `<journey.Step id>` wrapper or a component with an inline `id` prop. The
   * Provider asserts at every render that the child ids cover the definition
   * exactly; an order mismatch is a dev-mode error (the definition wins).
   */
  children: React.ReactNode;

  /**
   * Render-time override of the definition's initial context (route params,
   * server data, …). Read once at mount; the definition stays the type anchor.
   */
  initialContext?: TContext;
  /**
   * Render-time override of the starting step (deep links, resume, …). Read
   * once at mount; wins over the bundle options' `startAt`.
   */
  startAt?: TStepId;

  /** Rendered above/below the active step, INSIDE the journey context — both may call the bundle hooks. */
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

  /** Imperative escape hatch to the underlying core machine. */
  machineRef?: React.Ref<LinearJourneyMachine<TContext, TStepId>>;
};

/** Props of the `journey.Step` marker element: an id from the declared union, nothing else. */
export type LinearJourneyStepProps<TStepId extends string = string> = {
  id: TStepId;
  children: React.ReactNode;
};

/** Everything `journey.useJourney()` returns: the core machine and snapshot, verbatim. */
export type UseLinearJourneyResult<TContext = unknown, TStepId extends string = string> = {
  machine: LinearJourneyMachine<TContext, TStepId>;
  snapshot: LinearJourneySnapshot<TContext, TStepId>;
};

/**
 * What `createLinearJourney()` returns: a Provider, a Step marker, and hooks —
 * every one pre-bound to the definition's context and step-id types, so call
 * sites never pass generics. Each bundle owns a private React context;
 * machines are created per Provider mount, never in the factory.
 */
export type LinearJourneyBundle<TContext, TStepId extends string> = {
  Provider: (props: LinearProviderProps<TContext, TStepId>) => React.ReactElement;
  /** Marker element declaring which step a child renders; it never renders itself. */
  Step: (props: LinearJourneyStepProps<TStepId>) => React.ReactElement;
  /** The core machine and its live snapshot, verbatim. */
  useJourney: () => UseLinearJourneyResult<TContext, TStepId>;
  /** Subscribes to a derived slice of the snapshot; re-renders only when it changes. */
  useSelector: <TSelected>(
    selector: (snapshot: LinearJourneySnapshot<TContext, TStepId>) => TSelected,
    equalityFn?: (a: TSelected, b: TSelected) => boolean
  ) => TSelected;
  /** Registers forward-navigation work for the step component calling it. */
  useStep: <TResult = void>(handler?: LinearJourneyStepHandler<TContext, TResult>) => void;
};
