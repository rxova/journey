import type React from "react";
import type {
  AnyJourneyPlugin,
  JourneyEventPayloads,
  JourneyRuntimeOptions,
  JourneySubscriptionEvent,
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
 * A linear journey's core snapshot, verbatim. `currentStep` is null while the
 * machine is idle (`autoStart: false` before `controls.start()`), exactly as
 * in the graph tier.
 */
export type LinearJourneySnapshot<
  TContext = unknown,
  TStepId extends string = string
> = LinearSnapshot<TContext, TStepId, unknown>;

/** Core event payloads bound to the linear snapshot. */
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
  /** Optional bundle name, used for the Provider's React DevTools displayName. */
  readonly name?: string;
};

/** Core's creation options, passed through verbatim and frozen per bundle. */
export type LinearJourneyBundleOptions<TStepId extends string = string> = JourneyRuntimeOptions<
  readonly AnyJourneyPlugin[],
  TStepId
>;

/**
 * What each declared step renders, keyed by step id. Exhaustiveness is
 * type-checked: a missing key or an undeclared key is a compile error. Values
 * are elements (not component types), so props and wrappers stay inline.
 */
export type LinearJourneyViews<TStepId extends string> = {
  readonly [K in TStepId]: React.ReactNode;
};

/**
 * The Provider carries only the views for `<StepRenderer>` — the machine is
 * standalone on the bundle and needs no React context.
 */
export type LinearProviderProps<TStepId extends string> = {
  views: LinearJourneyViews<TStepId>;
  children: React.ReactNode;
};

/**
 * What `createLinearJourney()` returns — the same shape as the graph bundle,
 * with the linear verbs: one standalone machine created by the factory,
 * `navigate` where graph has `send`, and `useStepHandler` to gate
 * `goToNextStep` from a component. Every hook closes over the bundle's
 * machine, so all of them work with or without the Provider; the Provider
 * exists to hand `views` to `StepRenderer`.
 */
export type LinearJourneyBundle<TContext, TStepId extends string> = {
  /** The bundle's machine — created by the factory, usable outside React. */
  machine: LinearJourneyMachine<TContext, TStepId>;
  Provider: (props: LinearProviderProps<TStepId>) => React.ReactElement;
  /** Renders the active step's view; place it anywhere inside the Provider. */
  StepRenderer: React.ComponentType<{ fallback?: React.ReactNode }>;

  /** The machine's live snapshot (reactive). */
  useSnapshot: () => LinearJourneySnapshot<TContext, TStepId>;
  /** A derived slice of the snapshot; re-renders only when it changes (reactive). */
  useSelector: <TSelected>(
    selector: (snapshot: LinearJourneySnapshot<TContext, TStepId>) => TSelected,
    equalityFn?: (a: TSelected, b: TSelected) => boolean
  ) => TSelected;
  /** The current step — id, metadata, async state — or null while idle (reactive). */
  useStep: () => LinearJourneySnapshot<TContext, TStepId>["currentStep"];
  /** The machine's context value (reactive). */
  useContext: () => TContext;
  /** Subscribes a listener to a machine event for the component's lifetime. */
  useSubscribeEvent: <TEvent extends JourneySubscriptionEvent>(
    event: TEvent,
    listener: (payload: LinearJourneyEventPayloads<TContext, TStepId>[TEvent]) => void
  ) => void;

  /** The machine and its command groups, verbatim (stable — not reactive). */
  useMachine: () => LinearJourneyMachine<TContext, TStepId>;
  useControls: () => LinearJourneyMachine<TContext, TStepId>["controls"];
  useNavigation: () => LinearJourneyMachine<TContext, TStepId>["navigate"];

  /**
   * Registers forward-navigation work for `stepId` while the calling
   * component is mounted (the linear counterpart of graph `send` work):
   * `run` gates `goToNextStep`, a throw/reject cancels the move and lands in
   * `currentStep.async.error`, `commit` stages the context transactionally.
   */
  useStepHandler: <TResult = void>(
    stepId: TStepId,
    handler: LinearJourneyStepHandler<TContext, TResult>
  ) => void;

  /** `machine.navigate`, verbatim — callable from anywhere, React or not. */
  navigate: LinearJourneyMachine<TContext, TStepId>["navigate"];
  /** `machine.context.update`, verbatim — callable from anywhere, React or not. */
  updateContext: (updater: (context: TContext) => TContext) => void;
};
