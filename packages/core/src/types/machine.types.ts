import type {
  JourneyComputed,
  JourneyDefaultEventType,
  JourneyDefinition,
  JourneyEqualityFn,
  JourneyJsonObject,
  JourneyPayloadFor,
  JourneyResolvedDefinition,
  JourneySelector,
  JourneySendEvent,
  JourneySendResult,
  JourneySnapshot,
  JourneyTerminal
} from "./journey.types";
import type {
  JourneyCompleteObservationEvent,
  JourneyLifecycleErrorPhase,
  JourneyObservationEvent,
  JourneyStartObservationEvent,
  JourneyTerminateObservationEvent
} from "./observation.types";

/** Reasons why a machine snapshot changed. */
export type JourneyMachineSnapshotReason =
  | "async"
  | "context"
  | "navigation"
  | "reset"
  | "start"
  | "transition";

export type JourneyLifecycleErrorContext<TStepId extends string> = {
  phase: JourneyLifecycleErrorPhase;
  from: TStepId;
  to: TStepId | JourneyTerminal;
  eventType: string;
  transitionId: string | null;
};

/** Setup context passed to journey plugins when a machine is created. */
export type JourneyMachinePluginSetupContext<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown> = Record<never, never>,
  TStepMeta = unknown,
  THandlers extends Record<string, unknown> = Record<never, never>
> = {
  journey: JourneyDefinition<TContext, TStepId, TEventMap, TStepMeta, THandlers>;
  resolvedJourney: JourneyResolvedDefinition<TContext, TStepId, TEventMap, TStepMeta, THandlers>;
  options: {
    requireExplicitCompletion: boolean;
    defaultTimeoutMs: number | undefined;
  };
  buildInitialSnapshot: () => JourneySnapshot<TContext, TStepId>;
};

/** Snapshot-change details exposed to plugins. */
export type JourneyMachinePluginSnapshotChange<
  TContext extends JourneyJsonObject,
  TStepId extends string
> = {
  previousSnapshot: JourneySnapshot<TContext, TStepId>;
  snapshot: JourneySnapshot<TContext, TStepId>;
  reason: JourneyMachineSnapshotReason;
};

/** Hooks returned from a journey plugin setup call. */
export type JourneyMachinePluginHooks<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown> = Record<never, never>,
  TStepMeta = unknown,
  THandlers extends Record<string, unknown> = Record<never, never>,
  TExtension extends object = Record<never, never>
> = {
  hydrateSnapshot?: (
    snapshot: JourneySnapshot<TContext, TStepId>
  ) => JourneySnapshot<TContext, TStepId>;
  onSnapshotChange?: (change: JourneyMachinePluginSnapshotChange<TContext, TStepId>) => void;
  augmentMachine?: (context: {
    machine: JourneyMachine<TContext, TStepId, TEventMap, TStepMeta, THandlers>;
    journey: JourneyDefinition<TContext, TStepId, TEventMap, TStepMeta, THandlers>;
    resolvedJourney: JourneyResolvedDefinition<TContext, TStepId, TEventMap, TStepMeta, THandlers>;
  }) => TExtension;
  dispose?: () => void;
};

/** Plugin contract for extending journey machines without bloating the base entrypoint. */
export type JourneyMachinePlugin = {
  name: string;
  __extension__?: object;
  setup: <
    TContext extends JourneyJsonObject,
    TStepId extends string,
    TEventMap extends Record<string, unknown> = Record<never, never>,
    TStepMeta = unknown,
    THandlers extends Record<string, unknown> = Record<never, never>
  >(
    context: JourneyMachinePluginSetupContext<TContext, TStepId, TEventMap, TStepMeta, THandlers>
  ) => JourneyMachinePluginHooks<TContext, TStepId, TEventMap, TStepMeta, THandlers>;
};

type JourneyMachinePluginHooksFor<
  TPlugin,
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown>,
  TStepMeta,
  THandlers extends Record<string, unknown>
> = TPlugin extends {
  setup: (
    context: JourneyMachinePluginSetupContext<TContext, TStepId, TEventMap, TStepMeta, THandlers>
  ) => infer THooks;
}
  ? THooks
  : never;

type JourneyMachinePluginExtensionFor<
  TPlugin,
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown>,
  TStepMeta,
  THandlers extends Record<string, unknown>
> = TPlugin extends { __extension__?: infer TExtension }
  ? Exclude<TExtension, undefined> extends never
    ? JourneyMachinePluginHooksFor<
        TPlugin,
        TContext,
        TStepId,
        TEventMap,
        TStepMeta,
        THandlers
      > extends {
        augmentMachine?: (...args: never[]) => infer THookExtension;
      }
      ? THookExtension
      : Record<never, never>
    : Exclude<TExtension, undefined>
  : JourneyMachinePluginHooksFor<
        TPlugin,
        TContext,
        TStepId,
        TEventMap,
        TStepMeta,
        THandlers
      > extends {
        augmentMachine?: (...args: never[]) => infer THookExtension;
      }
    ? THookExtension
    : Record<never, never>;

type UnionToIntersection<TValue> = [TValue] extends [never]
  ? Record<never, never>
  : (TValue extends unknown ? (value: TValue) => void : never) extends (
        value: infer TIntersection
      ) => void
    ? TIntersection
    : Record<never, never>;

type JourneyTypeParam<TValue> = TValue extends unknown ? unknown : never;

/** Optional machine features and plugin registration. */
export type JourneyMachineOptions<
  TPlugins extends readonly JourneyMachinePlugin[] = readonly JourneyMachinePlugin[]
> = {
  requireExplicitCompletion?: boolean;
  defaultTimeoutMs?: number;
  plugins?: TPlugins;
  /**
   * Called when a snapshot or event listener throws an unhandled error.
   * Listener failures are isolated so they never block other listeners or
   * the machine itself — use this hook to report them to your error
   * monitoring system (e.g. Sentry, Datadog).
   *
   * @param error - The thrown value (may not be an `Error` instance).
   * @param context - `"snapshot"` for `subscribe()` listeners,
   *   `"event"` for `subscribeEvent()` listeners.
   */
  onListenerError?: (error: unknown, context: "snapshot" | "event") => void;
  onLifecycleError?: (error: unknown, context: JourneyLifecycleErrorContext<string>) => void;
};

type JourneyPayloadForDefaultEvent<
  TEventMap extends Record<string, unknown>,
  TDefaultEvent extends JourneyDefaultEventType
> = JourneyPayloadFor<TEventMap, TDefaultEvent>;

/** Runtime machine API for reading snapshots, sending events, and controlling flow. */
export type JourneyMachine<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown> = Record<never, never>,
  TStepMeta = unknown,
  THandlers extends Record<string, unknown> = Record<never, never>
> = JourneyTypeParam<THandlers> & {
  getSnapshot: () => JourneySnapshot<TContext, TStepId>;
  getStepMeta: (stepId: TStepId) => TStepMeta | undefined;
  getComputed: () => JourneyComputed<TStepId>;
  start: () => Promise<JourneySnapshot<TContext, TStepId>>;
  send: (
    event: JourneySendEvent<TStepId, TEventMap>
  ) => Promise<JourneySendResult<TContext, TStepId>>;
  goToNextStep: () => Promise<JourneySendResult<TContext, TStepId>>;
  goToStepById: (stepId: TStepId) => Promise<JourneySendResult<TContext, TStepId>>;
  terminateJourney: (
    payload?: JourneyPayloadForDefaultEvent<TEventMap, "terminateJourney">
  ) => Promise<JourneySendResult<TContext, TStepId>>;
  completeJourney: (
    payload?: JourneyPayloadForDefaultEvent<TEventMap, "completeJourney">
  ) => Promise<JourneySendResult<TContext, TStepId>>;
  goToPreviousStep: (steps?: number) => Promise<JourneySendResult<TContext, TStepId>>;
  goToLastVisitedStep: () => Promise<JourneySendResult<TContext, TStepId>>;
  updateContext: (
    updater: (context: TContext) => TContext
  ) => Promise<JourneySnapshot<TContext, TStepId>>;
  clearStepError: (stepId?: TStepId) => Promise<JourneySnapshot<TContext, TStepId>>;
  resetJourney: () => Promise<JourneySnapshot<TContext, TStepId>>;
  dispose: () => void;
  subscribe: (listener: () => void) => () => void;
  subscribeSelector: <TSelected>(
    selector: JourneySelector<TContext, TStepId, TSelected>,
    listener: (next: TSelected, previous: TSelected) => void,
    equalityFn?: JourneyEqualityFn<TSelected>
  ) => () => void;
  subscribeEvent: (
    listener: (event: JourneyObservationEvent<TStepId, TEventMap>) => void
  ) => () => void;
  subscribeStart: (listener: (event: JourneyStartObservationEvent<TStepId>) => void) => () => void;
  subscribeComplete: (
    listener: (event: JourneyCompleteObservationEvent<TStepId>) => void
  ) => () => void;
  subscribeTerminate: (
    listener: (event: JourneyTerminateObservationEvent<TStepId>) => void
  ) => () => void;
};

/** Journey machine API augmented by plugin-provided extensions. */
export type JourneyMachineWithPlugins<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown> = Record<never, never>,
  TStepMeta = unknown,
  THandlers extends Record<string, unknown> = Record<never, never>,
  TPlugins extends readonly JourneyMachinePlugin[] = readonly JourneyMachinePlugin[]
> = JourneyMachine<TContext, TStepId, TEventMap, TStepMeta, THandlers> &
  UnionToIntersection<
    JourneyMachinePluginExtensionFor<
      TPlugins[number],
      TContext,
      TStepId,
      TEventMap,
      TStepMeta,
      THandlers
    >
  >;
