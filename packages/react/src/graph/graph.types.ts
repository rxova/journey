import type React from "react";
import type {
  AnyJourneyPlugin,
  GraphJourneyMachine,
  GraphSnapshot,
  JourneyEventObject,
  JourneySubscriptionEvent
} from "@rxova/journey-core";
import type { EventPayloadOf } from "../headless/use-journey-event";

/**
 * What each step renders, keyed by step id. Exhaustiveness is type-checked: a
 * missing key or an undeclared key is a compile error. Values are elements
 * (not component types), so props and wrappers stay inline — same contract as
 * the linear tier.
 */
export type GraphJourneyViews<TStepId extends string> = {
  readonly [K in TStepId]: React.ReactNode;
};

/**
 * The Provider carries only the views for `<StepRenderer>` — the machine is
 * standalone on the bundle and needs no React context.
 */
export type GraphProviderProps<TStepId extends string> = {
  views: GraphJourneyViews<TStepId>;
  children: React.ReactNode;
};

/**
 * The graph bundle: one standalone machine plus the React shell around it.
 * Every hook closes over the bundle's machine, so all of them work with or
 * without the Provider — the Provider exists to hand `views` to
 * `<StepRenderer>`, which is the only piece that must render inside it.
 */
export type GraphJourneyBundle<
  TContext,
  TStepId extends string,
  TEvents extends JourneyEventObject = JourneyEventObject,
  TMeta = Record<string, unknown>,
  TPlugins extends readonly AnyJourneyPlugin[] = readonly []
> = {
  /** The bundle's machine — created by the factory, usable outside React. */
  machine: GraphJourneyMachine<TContext, TStepId, TEvents, TMeta, TPlugins>;
  Provider: React.ComponentType<GraphProviderProps<TStepId>>;
  /** Renders the active step's view; place it anywhere inside the Provider. */
  StepRenderer: React.ComponentType<{ fallback?: React.ReactNode }>;

  /** The machine's live snapshot (reactive). */
  useSnapshot: () => GraphSnapshot<TContext, TStepId, TMeta, TEvents>;
  /** A derived slice of the snapshot; re-renders only when it changes (reactive). */
  useSelector: <TSelected>(
    selector: (snapshot: GraphSnapshot<TContext, TStepId, TMeta, TEvents>) => TSelected,
    equalityFn?: (a: TSelected, b: TSelected) => boolean
  ) => TSelected;
  /** The current step — id, metadata, async state — or null while idle (reactive). */
  useStep: () => GraphSnapshot<TContext, TStepId, TMeta, TEvents>["currentStep"];
  /** The machine's context value (reactive). */
  useContext: () => TContext;
  /** Subscribes a listener to a machine event for the component's lifetime. */
  useSubscribeEvent: <TEvent extends JourneySubscriptionEvent>(
    event: TEvent,
    listener: (
      payload: EventPayloadOf<
        GraphJourneyMachine<TContext, TStepId, TEvents, TMeta, TPlugins>,
        TEvent
      >
    ) => void
  ) => void;

  /** The machine and its command groups, verbatim (stable — not reactive). */
  useMachine: () => GraphJourneyMachine<TContext, TStepId, TEvents, TMeta, TPlugins>;
  useControls: () => GraphJourneyMachine<TContext, TStepId, TEvents, TMeta, TPlugins>["controls"];
  useNavigation: () => GraphJourneyMachine<TContext, TStepId, TEvents, TMeta, TPlugins>["navigate"];

  /** `machine.send`, verbatim — callable from anywhere, React or not. */
  send: GraphJourneyMachine<TContext, TStepId, TEvents, TMeta, TPlugins>["send"];
  /** `machine.context.update`, verbatim — callable from anywhere, React or not. */
  updateContext: (updater: (context: TContext) => TContext) => void;
};
