import type React from "react";
import type {
  AnyJourneyPlugin,
  GraphJourneyMachine,
  GraphSnapshot,
  JourneyEventObject,
  JourneyEventPayloads,
  JourneyRuntimeOptions,
  JourneySnapshot,
  JourneySubscriptionEvent,
  LinearJourneyMachine as CoreLinearJourneyMachine,
  LinearSnapshot,
  LinearStepInput,
  NavigationWork
} from "@rxova/journey-core";

// ---------------------------------------------------------------------------
// Machine inference — typing any core machine held outside a bundle
// ---------------------------------------------------------------------------

/** Any subscription event payload, with the widest snapshot/step typing. */
type AnyEventPayload = JourneyEventPayloads<unknown, string>[JourneySubscriptionEvent];

/**
 * The structural machine surface the headless hooks require. Every core
 * `create*Journey` result satisfies it; the hooks infer their concrete
 * snapshot/step types from the machine you pass, so a store-held, prop-passed,
 * or `useOwnedJourney`-owned machine all type identically.
 *
 * Method syntax (not arrow-property syntax) is deliberate: method signatures
 * compare parameters bivariantly, so concretely-typed machines satisfy this
 * structural surface without variance gymnastics.
 */
export type AnyJourneyMachine = {
  getSnapshot(): JourneySnapshot;
  subscriptions: {
    subscribeSelector(
      selector: (snapshot: JourneySnapshot) => unknown,
      listener: (selected: unknown) => void,
      equals?: (a: unknown, b: unknown) => boolean
    ): () => void;
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
  StepRenderer: React.ComponentType<{ fallback?: React.ReactNode }>;

  /** The machine's live snapshot (reactive). */
  useSnapshot: () => TSnapshot;
  /** A derived slice of the snapshot; re-renders only when it changes (reactive). */
  useSelector: <TSelected>(
    selector: (snapshot: TSnapshot) => TSelected,
    equalityFn?: (a: TSelected, b: TSelected) => boolean
  ) => TSelected;
  /** The current step — id, metadata, async state — or null while idle (reactive). */
  useStep: () => TSnapshot["currentStep"];
  /** The machine's context value (reactive). */
  useContext: () => TContext;
  /** Subscribes a listener to a machine event for the component's lifetime. */
  useSubscribeEvent: <TEvent extends JourneySubscriptionEvent>(
    event: TEvent,
    listener: (payload: JourneyEventPayloads<TContext, TStepId, TSnapshot>[TEvent]) => void
  ) => void;

  /** The machine and its command groups, verbatim (stable — not reactive). */
  useMachine: () => TMachine;
  useControls: () => TMachine["controls"];
  useNavigation: () => TMachine["navigate"];

  /** `machine.context.update`, verbatim — callable from anywhere, React or not. */
  updateContext: (updater: (context: TContext) => TContext) => void;
};

// ---------------------------------------------------------------------------
// Linear tier
// ---------------------------------------------------------------------------

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
 * What `createLinearJourney()` returns: the shared bundle surface with the
 * linear verbs — `navigate` where graph has `send`, and `useStepHandler` to
 * gate `goToNextStep` from a component.
 */
export type LinearJourneyBundle<TContext, TStepId extends string> = JourneyBundleBase<
  LinearJourneyMachine<TContext, TStepId>,
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
    handler: LinearJourneyStepHandler<TContext, TResult>
  ) => void;

  /** `machine.navigate`, verbatim — callable from anywhere, React or not. */
  navigate: LinearJourneyMachine<TContext, TStepId>["navigate"];
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
