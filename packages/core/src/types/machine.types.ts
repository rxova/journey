import type {
  GraphJourneySnapshot,
  JourneyBaseEvent,
  JourneyComputed,
  JourneyDefaultEventType,
  JourneyDefinition,
  JourneyEqualityFn,
  JourneyGraphComputed,
  JourneyJsonObject,
  JourneyLinearComputed,
  JourneyPayloadFor,
  JourneyResolvedDefinition,
  JourneySelector,
  JourneySendEvent,
  JourneySendResult,
  JourneySnapshot,
  JourneySnapshotStateBase,
  JourneyTerminal,
  LinearJourneySnapshot
} from "./journey.types";
import type { JourneyLifecycleErrorPhase, JourneyObservationEvent } from "./observation.types";
import type { JourneyEmpty } from "./journey.types";

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
  label?: string;
};

/**
 * Describes a sent event that matched no enabled transition — every candidate
 * was guarded and none passed, or no candidate was declared at all — and was
 * therefore silently dropped. Surfaced through {@link JourneyMachineOptions.onNoMatch}.
 */
export type JourneyNoMatchContext<TStepId extends string> = {
  from: TStepId;
  eventType: string;
};

/** Setup context passed to journey plugins when a machine is created. */
export type JourneyMachinePluginSetupContext<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEvents extends JourneyBaseEvent = never,
  TStepMeta = unknown,
  THandlers extends Record<string, unknown> = JourneyEmpty
> = {
  journey: JourneyDefinition<TContext, TStepId, TEvents, TStepMeta, THandlers>;
  resolvedJourney: JourneyResolvedDefinition<TContext, TStepId, TEvents, TStepMeta, THandlers>;
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

export type JourneyMachineDevtoolsFieldType = "text" | "integer" | "boolean" | "json";

export type JourneyMachineDevtoolsFieldSpec = {
  key: string;
  label: string;
  type: JourneyMachineDevtoolsFieldType;
  required?: boolean;
  description?: string;
  placeholder?: string;
  min?: number;
  max?: number;
};

export type JourneyMachineDevtoolsOperationResultKind = "snapshot" | "data" | "text" | "void";

export type JourneyMachineDevtoolsOperationResult<
  TContext extends JourneyJsonObject,
  TStepId extends string
> =
  | {
      kind: "snapshot";
      snapshot: JourneySnapshot<TContext, TStepId>;
      transitioned?: boolean;
      transitionId?: string;
      error?: unknown;
    }
  | {
      kind: "data";
      data: unknown;
    }
  | {
      kind: "text";
      text: string;
    }
  | {
      kind: "void";
    };

export type JourneyMachineDevtoolsOperationSpec<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEvents extends JourneyBaseEvent = never,
  TStepMeta = unknown,
  THandlers extends Record<string, unknown> = JourneyEmpty
> = {
  id: string;
  label: string;
  description?: string;
  mutates: boolean;
  output: JourneyMachineDevtoolsOperationResultKind;
  fields?: readonly JourneyMachineDevtoolsFieldSpec[];
  run: (context: {
    machine: JourneyMachine<TContext, TStepId, TEvents, TStepMeta, THandlers>;
    input: Record<string, unknown> | undefined;
    journey: JourneyDefinition<TContext, TStepId, TEvents, TStepMeta, THandlers>;
    resolvedJourney: JourneyResolvedDefinition<TContext, TStepId, TEvents, TStepMeta, THandlers>;
  }) =>
    | JourneyMachineDevtoolsOperationResult<TContext, TStepId>
    | Promise<JourneyMachineDevtoolsOperationResult<TContext, TStepId>>;
};

export type JourneyMachineDevtoolsFeatureSpec<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEvents extends JourneyBaseEvent = never,
  TStepMeta = unknown,
  THandlers extends Record<string, unknown> = JourneyEmpty
> = {
  id: string;
  label: string;
  description?: string;
  operations: readonly JourneyMachineDevtoolsOperationSpec<
    TContext,
    TStepId,
    TEvents,
    TStepMeta,
    THandlers
  >[];
};

/** Hooks returned from a journey plugin setup call. */
export type JourneyMachinePluginHooks<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEvents extends JourneyBaseEvent = never,
  TStepMeta = unknown,
  THandlers extends Record<string, unknown> = JourneyEmpty,
  TExtension extends object = JourneyEmpty
> = {
  hydrateSnapshot?: (
    snapshot: JourneySnapshot<TContext, TStepId>
  ) => JourneySnapshot<TContext, TStepId>;
  onSnapshotChange?: (change: JourneyMachinePluginSnapshotChange<TContext, TStepId>) => void;
  augmentMachine?: (context: {
    machine: JourneyMachine<TContext, TStepId, TEvents, TStepMeta, THandlers>;
    journey: JourneyDefinition<TContext, TStepId, TEvents, TStepMeta, THandlers>;
    resolvedJourney: JourneyResolvedDefinition<TContext, TStepId, TEvents, TStepMeta, THandlers>;
  }) => TExtension;
  getDevtoolsFeatures?: (context: {
    machine: JourneyMachine<TContext, TStepId, TEvents, TStepMeta, THandlers>;
    journey: JourneyDefinition<TContext, TStepId, TEvents, TStepMeta, THandlers>;
    resolvedJourney: JourneyResolvedDefinition<TContext, TStepId, TEvents, TStepMeta, THandlers>;
  }) => readonly JourneyMachineDevtoolsFeatureSpec<
    TContext,
    TStepId,
    TEvents,
    TStepMeta,
    THandlers
  >[];
  dispose?: () => void;
};

/** Plugin contract for extending journey machines without bloating the base entrypoint. */
export type JourneyMachinePlugin = {
  name: string;
  __extension__?: object;
  setup: <
    TContext extends JourneyJsonObject,
    TStepId extends string,
    TEvents extends JourneyBaseEvent = never,
    TStepMeta = unknown,
    THandlers extends Record<string, unknown> = JourneyEmpty
  >(
    context: JourneyMachinePluginSetupContext<TContext, TStepId, TEvents, TStepMeta, THandlers>
  ) => JourneyMachinePluginHooks<TContext, TStepId, TEvents, TStepMeta, THandlers>;
};

type JourneyMachinePluginHooksFor<
  TPlugin,
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEvents extends JourneyBaseEvent,
  TStepMeta,
  THandlers extends Record<string, unknown>
> = TPlugin extends {
  setup: (
    context: JourneyMachinePluginSetupContext<TContext, TStepId, TEvents, TStepMeta, THandlers>
  ) => infer THooks;
}
  ? THooks
  : never;

type JourneyMachinePluginExtensionFor<
  TPlugin,
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEvents extends JourneyBaseEvent,
  TStepMeta,
  THandlers extends Record<string, unknown>
> = TPlugin extends { __extension__?: infer TExtension }
  ? Exclude<TExtension, undefined> extends never
    ? JourneyMachinePluginHooksFor<
        TPlugin,
        TContext,
        TStepId,
        TEvents,
        TStepMeta,
        THandlers
      > extends {
        augmentMachine?: (...args: never[]) => infer THookExtension;
      }
      ? THookExtension
      : JourneyEmpty
    : Exclude<TExtension, undefined>
  : JourneyMachinePluginHooksFor<
        TPlugin,
        TContext,
        TStepId,
        TEvents,
        TStepMeta,
        THandlers
      > extends {
        augmentMachine?: (...args: never[]) => infer THookExtension;
      }
    ? THookExtension
    : JourneyEmpty;

type UnionToIntersection<TValue> = [TValue] extends [never]
  ? JourneyEmpty
  : (TValue extends unknown ? (value: TValue) => void : never) extends (
        value: infer TIntersection
      ) => void
    ? TIntersection
    : JourneyEmpty;

type JourneyTypeParam<TValue> = TValue extends unknown ? unknown : never;

/** Optional machine features and plugin registration. */
export type JourneyMachineOptions<
  TPlugins extends readonly JourneyMachinePlugin[] = readonly JourneyMachinePlugin[],
  THandlers extends Record<string, unknown> = Record<string, unknown>
> = {
  requireExplicitCompletion?: boolean;
  defaultTimeoutMs?: number;
  plugins?: TPlugins;
  /**
   * Start the machine from this snapshot state instead of the definition's
   * initial step. The seam for dynamic-step transplants, tests, and SSR resume.
   *
   * The machine's own shape is authoritative: any `type`/`stepOrder` on the
   * value is ignored and re-stamped, `visited` is filtered to known steps,
   * async state is rebuilt fresh, and `status` is preserved as given (unlike
   * persistence hydration, which downgrades `"running"` — this option trusts
   * its programmatic caller). Every timeline step must exist in the definition
   * or a `JourneyDefinitionError` is thrown. Plugins still run their
   * `hydrateSnapshot` hooks over the result, so configured persistence wins.
   */
  initialSnapshot?: JourneySnapshotStateBase<JourneyJsonObject, string>;
  /**
   * Override or supply `handlers` at machine creation, shallow-merged over the
   * `handlers` declared on the definition (per-key; creation wins). This is the
   * dependency-injection seam for tests — Journey's typed equivalent of XState's
   * `.provide()` — letting a test swap I/O implementations without rebuilding
   * the definition. Provide a subset; keys you omit fall back to the definition.
   */
  handlers?: Partial<THandlers>;
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
  /**
   * Called when a sent event matches no enabled transition — every candidate is
   * guarded and none pass, or none is declared — so the event is dropped with no
   * state change. Use it to surface otherwise-silent dropped events. When omitted,
   * a development-only warning is logged instead. Internal synthetic events
   * (`effect`/`after`) never trigger this hook.
   */
  onNoMatch?: (context: JourneyNoMatchContext<string>) => void;
};

type JourneyPayloadForDefaultEvent<
  TEvents extends JourneyBaseEvent,
  TDefaultEvent extends JourneyDefaultEventType
> = JourneyPayloadFor<TEvents, TDefaultEvent>;

/**
 * Lifecycle command surface, grouped under `machine.controls` to keep the
 * machine's top level focused on reading state and navigating. Everything
 * here changes the journey's run status rather than its position.
 */
export type JourneyMachineControls<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEvents extends JourneyBaseEvent = never
> = {
  /** Starts an idled journey (`idled → running`); a no-op on any other status. */
  start: () => Promise<JourneySnapshot<TContext, TStepId>>;
  /** Cancels in-flight work and restores the fresh initial snapshot. */
  reset: () => Promise<JourneySnapshot<TContext, TStepId>>;
  /**
   * Pauses the machine: navigation and `send` resolve as no-ops carrying
   * `noOpReason: "paused"` (including internal effect/after routing), while
   * `updateContext`, `controls.start`, `controls.reset`, and `clearStepError`
   * keep working. Transient runtime flag — never part of the snapshot, never
   * persisted. Emits a `journey.paused` observation event.
   */
  pause: () => void;
  /** Clears a pause set by {@link pause}. Emits `journey.resumed`. */
  resume: () => void;
  /** True while the machine is paused. Transient; not part of the snapshot. */
  isPaused: () => boolean;
  /** Completes the journey (dispatches the default `completeJourney` event). */
  complete: (
    payload?: JourneyPayloadForDefaultEvent<TEvents, "completeJourney">
  ) => Promise<JourneySendResult<TContext, TStepId>>;
  /** Terminates the journey (dispatches the default `terminateJourney` event). */
  terminate: (
    payload?: JourneyPayloadForDefaultEvent<TEvents, "terminateJourney">
  ) => Promise<JourneySendResult<TContext, TStepId>>;
};

/** Runtime machine API for reading snapshots, sending events, and controlling flow. */
export type JourneyMachine<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEvents extends JourneyBaseEvent = never,
  TStepMeta = unknown,
  THandlers extends Record<string, unknown> = JourneyEmpty
> = JourneyTypeParam<THandlers> & {
  getSnapshot: () => JourneySnapshot<TContext, TStepId>;
  getStepMeta: (stepId: TStepId) => TStepMeta | undefined;
  getComputed: () => JourneyComputed<TStepId>;
  /** Lifecycle commands: start/reset/pause/resume/complete/terminate. */
  controls: JourneyMachineControls<TContext, TStepId, TEvents>;
  send: (
    event: JourneySendEvent<TStepId, TEvents>
  ) => Promise<JourneySendResult<TContext, TStepId>>;
  goToNextStep: () => Promise<JourneySendResult<TContext, TStepId>>;
  goToStepById: (stepId: TStepId) => Promise<JourneySendResult<TContext, TStepId>>;
  goToPreviousStep: (steps?: number) => Promise<JourneySendResult<TContext, TStepId>>;
  goToLastVisitedStep: () => Promise<JourneySendResult<TContext, TStepId>>;
  updateContext: (
    updater: (context: TContext) => TContext
  ) => Promise<JourneySnapshot<TContext, TStepId>>;
  clearStepError: (stepId?: TStepId) => Promise<JourneySnapshot<TContext, TStepId>>;
  dispose: () => void;
  subscribe: (listener: () => void) => () => void;
  subscribeSelector: <TSelected>(
    selector: JourneySelector<TContext, TStepId, TSelected>,
    listener: (next: TSelected, previous: TSelected) => void,
    equalityFn?: JourneyEqualityFn<TSelected>
  ) => () => void;
  subscribeEvent: (
    listener: (event: JourneyObservationEvent<TStepId, TEvents>) => void
  ) => () => void;
};

/**
 * Async interceptor awaited before `goToNextStep` commits, registered per
 * step via {@link LinearJourneyMachine.registerNextStepInterceptor}. A
 * throw/reject cancels the navigation; while pending, the step's async state
 * reports the `evaluating-when` phase.
 */
export type LinearNextStepInterceptor<TContext extends JourneyJsonObject> = (args: {
  context: TContext;
  updateContext: (
    updater: (context: TContext) => TContext
  ) => Promise<JourneySnapshot<TContext, string>>;
}) => void | Promise<void>;

/**
 * Linear journey machine — base machine plus index-based navigation, with
 * `getSnapshot`/`getComputed` narrowed to the linear variants (no cast needed
 * to reach `visits`, `stepOrder`, or `isStepFirstTimeVisit`).
 */
export type LinearJourneyMachine<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TStepMeta = unknown,
  THandlers extends Record<string, unknown> = JourneyEmpty,
  TPlugins extends readonly JourneyMachinePlugin[] = readonly JourneyMachinePlugin[]
> = Omit<
  JourneyMachineWithPlugins<TContext, TStepId, never, TStepMeta, THandlers, TPlugins>,
  "getSnapshot" | "getComputed"
> & {
  getSnapshot: () => LinearJourneySnapshot<TContext, TStepId>;
  getComputed: () => JourneyLinearComputed<TStepId>;
  goToStepByIndex: (index: number) => Promise<JourneySendResult<TContext, TStepId>>;
  /**
   * Registers a forward-navigation interceptor for `stepId`: awaited by
   * `goToNextStep` while that step is active; a throw cancels the navigation
   * (the result carries the error and the step's async state reports it).
   * Returns an unregister function. Interceptors run in registration order.
   */
  registerNextStepInterceptor: (
    stepId: TStepId,
    interceptor: LinearNextStepInterceptor<TContext>
  ) => () => void;
};

/**
 * Graph journey machine — the plugin-extended machine with
 * `getSnapshot`/`getComputed` narrowed to the graph variants. The exact
 * mirror of {@link LinearJourneyMachine} for `createGraphJourney`.
 */
export type GraphJourneyMachine<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEvents extends JourneyBaseEvent = never,
  TStepMeta = unknown,
  THandlers extends Record<string, unknown> = JourneyEmpty,
  TPlugins extends readonly JourneyMachinePlugin[] = readonly JourneyMachinePlugin[]
> = Omit<
  JourneyMachineWithPlugins<TContext, TStepId, TEvents, TStepMeta, THandlers, TPlugins>,
  "getSnapshot" | "getComputed"
> & {
  getSnapshot: () => GraphJourneySnapshot<TContext, TStepId>;
  getComputed: () => JourneyGraphComputed<TStepId>;
};

/** Journey machine API augmented by plugin-provided extensions. */
export type JourneyMachineWithPlugins<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEvents extends JourneyBaseEvent = never,
  TStepMeta = unknown,
  THandlers extends Record<string, unknown> = JourneyEmpty,
  TPlugins extends readonly JourneyMachinePlugin[] = readonly JourneyMachinePlugin[]
> = JourneyMachine<TContext, TStepId, TEvents, TStepMeta, THandlers> &
  UnionToIntersection<
    JourneyMachinePluginExtensionFor<
      TPlugins[number],
      TContext,
      TStepId,
      TEvents,
      TStepMeta,
      THandlers
    >
  >;
