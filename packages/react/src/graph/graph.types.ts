import type React from "react";
import type {
  AnyJourneyPlugin,
  GraphJourneyMachine,
  GraphSnapshot,
  JourneyEventObject,
  JourneySubscriptionEvent,
  StepAsyncState
} from "@rxova/journey-core";
import type { EventPayloadOf } from "../headless/use-journey-event";

export type GraphProviderProps<TContext, TStepId extends string> = {
  /** Step id → component. The definition stays pure data; views live here. */
  views: Record<TStepId, React.ComponentType>;
  /** Per-mount context override, shallow-merged over the definition's context. */
  context?: Partial<TContext>;
  /** Start the journey automatically on mount. Default true. */
  autoStart?: boolean;
  onError?: (error: unknown, context: { phase: "start" }) => void;
  /** Imperative escape hatch to this mount's machine. */
  machineRef?: React.Ref<unknown>;
  children: React.ReactNode;
};

/** The graph bundle: Provider/StepRenderer plus prefix-less namespaced hooks. */
export type GraphJourneyBundle<
  TContext,
  TStepId extends string,
  TEvents extends JourneyEventObject = JourneyEventObject,
  TMeta = Record<string, unknown>,
  TPlugins extends readonly AnyJourneyPlugin[] = readonly []
> = {
  Provider: React.ComponentType<GraphProviderProps<TContext, TStepId>>;
  StepRenderer: React.ComponentType<{ fallback?: React.ReactNode }>;
  useSnapshot: () => GraphSnapshot<TContext, TStepId, TMeta, TEvents>;
  useSelector: <TSelected>(
    selector: (snapshot: GraphSnapshot<TContext, TStepId, TMeta, TEvents>) => TSelected,
    equalityFn?: (a: TSelected, b: TSelected) => boolean
  ) => TSelected;
  /** The machine's command groups (`controls`, `navigate`, `send`), verbatim. */
  useApi: () => {
    controls: GraphJourneyMachine<TContext, TStepId, TEvents, TMeta, TPlugins>["controls"];
    navigate: GraphJourneyMachine<TContext, TStepId, TEvents, TMeta, TPlugins>["navigate"];
    send: GraphJourneyMachine<TContext, TStepId, TEvents, TMeta, TPlugins>["send"];
    updateContext: (updater: (context: TContext) => TContext) => void;
  };
  useStepAsyncState: (stepId: TStepId) => StepAsyncState;
  useEvent: <TEvent extends JourneySubscriptionEvent>(
    event: TEvent,
    listener: (
      payload: EventPayloadOf<
        GraphJourneyMachine<TContext, TStepId, TEvents, TMeta, TPlugins>,
        TEvent
      >
    ) => void
  ) => void;
  useStepLifecycle: (
    stepId: TStepId,
    callbacks: {
      onEnter?: (args: { context: TContext }) => void;
      onLeave?: (args: { context: TContext }) => void;
    }
  ) => void;
  useMachine: () => GraphJourneyMachine<TContext, TStepId, TEvents, TMeta, TPlugins>;
};
