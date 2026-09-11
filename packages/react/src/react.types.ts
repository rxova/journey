import type React from "react";
import type {
  AnyJourneyPlugin,
  Bag,
  GraphDefinition,
  GraphJourneyMachine,
  GraphSnapshot,
  GraphStep,
  GraphStepConfig,
  JourneyEventObject,
  JourneyEventPayloads,
  JourneyRuntimeOptions,
  JourneySnapshot,
  JourneySubscriptionEvent,
  LinearJourneyMachine as CoreLinearJourneyMachine,
  LinearSnapshot,
  LinearStepConfig,
  NavigationWork
} from "@rxova/journey-core";

// ---------------------------------------------------------------------------
// Machine inference — typing any core machine held outside a bundle
// ---------------------------------------------------------------------------

/** Any subscription event payload, with the widest snapshot/step typing. */
type AnyEventPayload = JourneyEventPayloads<unknown, string>[JourneySubscriptionEvent];

/**
 * The structural surface every core `create*Journey` machine satisfies. Use
 * it to type a caller-owned machine held outside a bundle — in a store, a
 * prop, or a `useState` initializer — and let `SnapshotOf`/`StepIdOf`/
 * `ContextOf` infer the concrete types from whichever machine you pass.
 *
 * Method syntax (not arrow-property syntax) is deliberate: method signatures
 * compare parameters bivariantly, so concretely-typed machines satisfy this
 * structural surface without variance gymnastics.
 */
export type AnyJourneyMachine = {
  getSnapshot(): JourneySnapshot;
  subscriptions: {
    subscribe(listener: () => void): () => void;
    subscribeEvent(
      event: JourneySubscriptionEvent,
      listener: (payload: AnyEventPayload) => void
    ): () => void;
  };
  dispose(): void;
};

/** The exact snapshot type a machine emits. */
export type SnapshotOf<TMachine> = TMachine extends { getSnapshot(): infer TSnapshot }
  ? TSnapshot
  : never;

/** The step-id union of a machine, inferred from its snapshot's visited map. */
export type StepIdOf<TMachine> =
  SnapshotOf<TMachine> extends { history: { visited: Readonly<Record<infer TStepId, boolean>> } }
    ? Extract<TStepId, string>
    : never;

/** The context type of a machine, inferred from its snapshot. */
export type ContextOf<TMachine> =
  SnapshotOf<TMachine> extends { context: infer TContext } ? TContext : never;

/** The payload a machine delivers for one of its subscription events. */
export type EventPayloadOf<
  TMachine,
  TEvent extends JourneySubscriptionEvent
> = JourneyEventPayloads<ContextOf<TMachine>, StepIdOf<TMachine>, SnapshotOf<TMachine>>[TEvent];

/**
 * The minimum a bundle must expose for `useJourney()` to own its lifetime.
 * Both tiers satisfy it; so does any object wrapping a core machine.
 */
export type OwnedJourneyBundle = {
  machine: { dispose: () => void };
};

// ---------------------------------------------------------------------------
// Shared bundle surface — everything the two tiers have in common
// ---------------------------------------------------------------------------

/**
 * What each declared step renders, keyed by step id. Exhaustiveness is
 * type-checked: a missing key or an undeclared key is a compile error. Values
 * are elements (not component types), so props and wrappers stay inline —
 * the same contract in both tiers.
 */
export type JourneyViews<TStepId extends string> = {
  readonly [K in TStepId]: React.ReactNode;
};

/**
 * The Provider carries only the views for `<StepRenderer>` — the machine is
 * standalone on the bundle and needs no React context.
 */
export type JourneyProviderProps<TStepId extends string> = {
  views: JourneyViews<TStepId>;
  children: React.ReactNode;
};

/** Props of `<StepRenderer>`: what to render while idle or when the active id has no view. */
export type JourneyStepRendererProps = {
  fallback?: React.ReactNode;
};

/**
 * The surface both bundles share: one standalone machine created by the
 * factory, the Provider/StepRenderer pair, and hooks that close over the
 * machine (so all of them work with or without the Provider — the Provider
 * exists to hand `views` to `<StepRenderer>`). The tiers differ only in their
 * verbs: linear adds `navigate` + `useStepHandler`, graph adds `send`.
 */
export type JourneyBundleBase<
  TMachine extends { controls: unknown; navigate: unknown },
  TContext,
  TStepId extends string,
  TSnapshot extends { currentStep: unknown }
> = {
  /** The bundle's machine — created by the factory, usable outside React. */
  machine: TMachine;
  Provider: (props: JourneyProviderProps<TStepId>) => React.ReactElement;
  /** Renders the active step's view; place it anywhere inside the Provider. */
  StepRenderer: (props: JourneyStepRendererProps) => React.ReactElement;

  /** The machine's live snapshot (reactive). */
  useSnapshot: () => TSnapshot;
  /** A derived slice of the snapshot; re-renders only when it changes (reactive). */
  useSelector: <TSelected>(
    selector: (snapshot: TSnapshot) => TSelected,
    equalityFn?: (a: TSelected, b: TSelected) => boolean
  ) => TSelected;
  /** The current step — id, metadata, async state — or null while idle (reactive). */
  useStep: () => TSnapshot["currentStep"];
  /**
   * A derived slice of the machine's context; re-renders only when it changes
   * (reactive). The selector is required — `useContextSelector((c) => c)` is
   * the explicit way to ask for the whole object, and re-renders on every
   * context write by construction rather than by accident.
   */
  useContextSelector: <TSelected>(
    selector: (context: TContext) => TSelected,
    equalityFn?: (a: TSelected, b: TSelected) => boolean
  ) => TSelected;
  /** Subscribes a listener to a machine event for the component's lifetime. */
  useEventEffect: <TEvent extends JourneySubscriptionEvent>(
    event: TEvent,
    listener: (payload: JourneyEventPayloads<TContext, TStepId, TSnapshot>[TEvent]) => void
  ) => void;

  /**
   * `machine.controls`, verbatim — callable from anywhere, React or not.
   *
   * A plain property rather than a hook: it is the same frozen object on every
   * render, so a hook around it would only be a second spelling of
   * `bundle.controls` that happens to require a component to read it. The same
   * reasoning removed `useMachine`/`useControls`/`useNavigation` — reach the
   * machine through `bundle.machine`, and navigation through this tier's own
   * `navigate` (linear) or `send` (graph).
   */
  controls: TMachine["controls"];

  /** `machine.context.update`, verbatim — callable from anywhere, React or not. */
  updateContext: (updater: (context: TContext) => TContext) => void;
};

// ---------------------------------------------------------------------------
// Step configs — core's, minus the lifecycle hooks
// ---------------------------------------------------------------------------

/**
 * Why this tier drops step `onEnter`/`onLeave`: `<StepRenderer>` keys the
 * active view by step id, so mounting *is* enter and unmounting *is* leave. A
 * `useEffect` with a cleanup already says it, scoped to the component that
 * cares and able to touch React state — which a definition hook running inside
 * Core cannot. Core keeps both hooks; only the React definition refuses them.
 *
 * `onEnter?: never` rather than a bare `Omit`: excess-property checking fires
 * only on inline object literals, so a step declared in its own file and
 * annotated with Core's `LinearStepConfig`/`GraphStep` would otherwise keep its
 * hooks and compile clean here. The `never` makes the ban structural, which is
 * the difference between a rule and a suggestion.
 */
type NoStepLifecycle = {
  readonly onEnter?: never;
  readonly onLeave?: never;
};

/** Core's linear step config without the lifecycle hooks. */
export type ReactLinearStepConfig<
  TContext = unknown,
  TStepId extends string = string,
  TMeta = Record<string, unknown>
> = Omit<LinearStepConfig<TContext, TStepId, TMeta>, "onEnter" | "onLeave"> & NoStepLifecycle;

/**
 * A React linear step: a bare id, or a config without lifecycle hooks.
 *
 * Re-formed as a union rather than `Omit<LinearStepInput, …>`. `Omit` does not
 * distribute, so omitting over `string | LinearStepConfig` would `Pick` the
 * keys the two branches share — silently destroying both the string shorthand
 * and the object branch, with no error at the declaration site.
 */
export type ReactLinearStepInput<TContext, TMeta, TStepId extends string = string> =
  | TStepId
  | ReactLinearStepConfig<TContext, TStepId, TMeta>;

/** Core's graph step config without the lifecycle hooks. */
export type ReactGraphStepConfig<
  TContext,
  TStepId extends string,
  TEvents extends JourneyEventObject,
  TMeta,
  THandlers
> = Omit<GraphStepConfig<TContext, TStepId, TEvents, TMeta, THandlers>, "onEnter" | "onLeave"> &
  NoStepLifecycle;

/** A bag-pinned graph step without the lifecycle hooks. */
export type ReactGraphStep<TBag extends Bag> = Omit<GraphStep<TBag>, "onEnter" | "onLeave"> &
  NoStepLifecycle;

/** A bag-pinned graph definition whose steps carry no lifecycle hooks. */
export type ReactGraphDefinition<TBag extends Bag> = Omit<GraphDefinition<TBag>, "steps"> & {
  readonly steps: Readonly<Record<TBag["stepId"], ReactGraphStep<TBag>>>;
};

// ---------------------------------------------------------------------------
// Linear tier
// ---------------------------------------------------------------------------

/**
 * A linear journey's underlying core machine, verbatim. Step `metadata` is
 * `unknown` in this tier (the definition accepts any metadata value; narrow it
 * where you read it).
 */
export type LinearJourneyMachine<
  TContext = unknown,
  TStepId extends string = string,
  TPlugins extends readonly AnyJourneyPlugin[] = readonly []
> = CoreLinearJourneyMachine<TContext, TStepId, unknown, TPlugins>;

/**
 * A linear journey's core snapshot, verbatim — the exact type
 * `machine.getSnapshot()` returns. `currentStep` is null while the machine is
 * idle (`autoStart: false` before `controls.start()`), exactly as in the
 * graph tier.
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
export type LinearJourneyStepHandler<
  TContext = unknown,
  TResult = void,
  TStepId extends string = string
> = NavigationWork<TContext, TStepId, LinearJourneySnapshot<TContext, TStepId>, TResult>;

/**
 * The pure-data definition `createLinearJourney()` captures: core's own
 * `LinearJourneyDefinition` shape, minus the step lifecycle hooks. Step
 * `metadata` lives here — never in JSX; enter and leave are a `useEffect` with
 * a cleanup in the step's own view.
 */
export type LinearJourneyBundleDefinition<
  TContext,
  TSteps extends readonly ReactLinearStepInput<TContext, unknown>[] = readonly [
    ReactLinearStepInput<TContext, unknown>,
    ...ReactLinearStepInput<TContext, unknown>[]
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
export type LinearJourneyBundleOptions<
  TStepId extends string = string,
  TPlugins extends readonly AnyJourneyPlugin[] = readonly AnyJourneyPlugin[]
> = JourneyRuntimeOptions<TPlugins, TStepId>;

/**
 * What `createLinearJourney()` returns: the shared bundle surface with the
 * linear verbs — `navigate` where graph has `send`, and `useStepHandler` to
 * gate `goToNextStep` from a component. `TPlugins` flows from the options'
 * `plugins` tuple into `machine.plugins`, exactly as in the graph tier.
 */
export type LinearJourneyBundle<
  TContext,
  TStepId extends string,
  TPlugins extends readonly AnyJourneyPlugin[] = readonly []
> = JourneyBundleBase<
  LinearJourneyMachine<TContext, TStepId, TPlugins>,
  TContext,
  TStepId,
  LinearJourneySnapshot<TContext, TStepId>
> & {
  /**
   * Registers forward-navigation work for `stepId` while the calling
   * component is mounted (the linear counterpart of graph `send` work):
   * `run` gates `goToNextStep`, a throw/reject cancels the move and lands in
   * `currentStep.async.error`, `commit` stages the context transactionally.
   */
  useStepHandler: <TResult = void>(
    stepId: TStepId,
    handler: LinearJourneyStepHandler<TContext, TResult, TStepId>
  ) => void;

  /** `machine.navigate`, verbatim — callable from anywhere, React or not. */
  navigate: LinearJourneyMachine<TContext, TStepId, TPlugins>["navigate"];
};

// ---------------------------------------------------------------------------
// Graph tier
// ---------------------------------------------------------------------------

/**
 * What `createGraphJourney()` returns: the shared bundle surface with the
 * graph verb — `send`, verbatim off the machine.
 */
export type GraphJourneyBundle<
  TContext,
  TStepId extends string,
  TEvents extends JourneyEventObject = JourneyEventObject,
  TMeta = Record<string, unknown>,
  TPlugins extends readonly AnyJourneyPlugin[] = readonly []
> = JourneyBundleBase<
  GraphJourneyMachine<TContext, TStepId, TEvents, TMeta, TPlugins>,
  TContext,
  TStepId,
  GraphSnapshot<TContext, TStepId, TMeta, TEvents>
> & {
  /** `machine.send`, verbatim — callable from anywhere, React or not. */
  send: GraphJourneyMachine<TContext, TStepId, TEvents, TMeta, TPlugins>["send"];
};
