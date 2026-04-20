import {
  getJourneyMachineDevtoolsRegistry,
  type JourneyJsonObject,
  type JourneyMachine,
  type JourneyMachineDevtoolsFeatureSpec,
  type JourneyMachineDevtoolsOperationResult,
  type JourneyMode,
  type JourneyObservationEvent,
  type JourneySendResult,
  type JourneySnapshot
} from "@rxova/journey-core";
import {
  JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
  JOURNEY_DEVTOOLS_CHANNEL,
  JOURNEY_DEVTOOLS_EXTENSION_SOURCE,
  JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
  JOURNEY_DEVTOOLS_REPLAY_REQUEST,
  isJourneyDevtoolsEnvelope,
  type JourneyDevtoolsBridgeEnvelope,
  type JourneyDevtoolsBridgeOperationErrorEnvelope,
  type JourneyDevtoolsBridgeOperationResultEnvelope,
  type JourneyDevtoolsBridgeObservationEnvelope,
  type JourneyDevtoolsBridgeRegisterEnvelope,
  type JourneyDevtoolsBridgeSnapshotEnvelope,
  type JourneyDevtoolsBridgeUnregisterEnvelope,
  type JourneyDevtoolsMachineFeatureDescriptor,
  type JourneyDevtoolsOperationInvoke,
  type JourneyDevtoolsOperationResultPayload,
  type JourneyDevtoolsSerializableSnapshot,
  type JourneyDevtoolsSerializedError
} from "./protocol";

declare const process: { env?: { NODE_ENV?: string } } | undefined;

export type JourneyDevtoolsBridgeOptions = {
  machineId?: string;
  label?: string;
  enabled?: boolean;
  appName?: string;
  mutationsEnabled?: boolean;
  commandsEnabled?: boolean;
};

type JourneyImportMetaEnv = {
  DEV?: unknown;
  PROD?: unknown;
};

type OperationRunner<TContext extends JourneyJsonObject, TStepId extends string> = {
  descriptor: JourneyDevtoolsMachineFeatureDescriptor["operations"][number];
  run: (
    input: Record<string, unknown> | undefined
  ) => Promise<JourneyMachineDevtoolsOperationResult<TContext, TStepId>>;
};

const DEFAULT_MACHINE_LABEL = "Journey Machine";
const BUILT_IN_EVENT_TYPES = new Set([
  "goToNextStep",
  "goToPreviousStep",
  "goToStepById",
  "goToLastVisitedStep",
  "completeJourney",
  "terminateJourney"
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isReplayRequestMessage = (value: unknown): value is { type: string } =>
  isRecord(value) && value.type === JOURNEY_DEVTOOLS_REPLAY_REQUEST;

const resolveImportMetaEnvironment = (
  bundlerEnv: JourneyImportMetaEnv | null | undefined
): boolean | null => {
  if (!isRecord(bundlerEnv)) {
    return null;
  }
  if (bundlerEnv.PROD === true) {
    return false;
  }
  if (bundlerEnv.DEV === true) {
    return true;
  }
  return null;
};

const resolveNodeEnvironment = (nodeEnv: string | undefined): boolean | null => {
  if (typeof nodeEnv !== "string") {
    return null;
  }
  return nodeEnv !== "production";
};

export const resolveNonProductionEnvironment = (
  options: {
    bundlerEnv?: JourneyImportMetaEnv | null | undefined;
    nodeEnv?: string | undefined;
  } = {}
): boolean => {
  const resolvedBundlerEnv =
    "bundlerEnv" in options
      ? options.bundlerEnv
      : (import.meta as ImportMeta & { env?: JourneyImportMetaEnv }).env;
  const resolvedNodeEnv =
    "nodeEnv" in options
      ? options.nodeEnv
      : typeof process !== "undefined"
        ? process.env?.NODE_ENV
        : undefined;

  return (
    resolveImportMetaEnvironment(resolvedBundlerEnv) ??
    resolveNodeEnvironment(resolvedNodeEnv) ??
    false
  );
};

const resolveWindowTargetOrigin = (): string => {
  /* v8 ignore next 3 -- attachJourneyDevtools is browser-only; SSR calls return before posting. */
  if (typeof window === "undefined") {
    return "*";
  }
  return window.location.origin === "null" ? "*" : window.location.origin;
};

const isExpectedWindowOrigin = (origin: string): boolean => {
  if (origin.length === 0 || typeof window === "undefined") {
    return false;
  }
  const expected = window.location.origin;
  if (expected === "null") {
    return origin === "null";
  }
  return origin === expected;
};

const createJourneyMachineId = (): string =>
  `journey-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

class OperationRateLimiter {
  private timestamps: number[] = [];

  constructor(
    private readonly maxPerWindow = 100,
    private readonly windowMs = 10000
  ) {}

  isAllowed(): boolean {
    const now = Date.now();
    const cutoff = now - this.windowMs;
    this.timestamps = this.timestamps.filter((value) => value > cutoff);
    if (this.timestamps.length >= this.maxPerWindow) {
      return false;
    }
    this.timestamps.push(now);
    return true;
  }

  reset(): void {
    this.timestamps = [];
  }
}

const cloneForTransport = (value: unknown): unknown => {
  const transportValue =
    typeof structuredClone === "function"
      ? (() => {
          try {
            return structuredClone(value);
          } catch {
            return value;
          }
        })()
      : value;
  const seen = new WeakSet<object>();

  try {
    const serialized = JSON.stringify(transportValue, (_key, currentValue) => {
      if (typeof currentValue === "bigint") {
        return currentValue.toString();
      }
      if (typeof currentValue === "function") {
        return `[Function ${currentValue.name || "anonymous"}]`;
      }
      if (typeof currentValue === "symbol") {
        return currentValue.toString();
      }
      if (typeof currentValue === "object" && currentValue !== null) {
        if (seen.has(currentValue)) {
          return "[Circular]";
        }
        seen.add(currentValue);
      }
      return currentValue;
    });

    return serialized === undefined ? undefined : (JSON.parse(serialized) as unknown);
  } catch {
    return String(value);
  }
};

const serializeError = (error: unknown): JourneyDevtoolsSerializedError => {
  if (error instanceof Error) {
    const cause =
      "cause" in error && (error as { cause?: unknown }).cause !== undefined
        ? (error as { cause?: unknown }).cause
        : null;
    return {
      name: error.name,
      message: error.message,
      stack: typeof error.stack === "string" ? error.stack : null,
      cause: cloneForTransport(cause)
    };
  }

  return {
    name: null,
    message: typeof error === "string" ? error : "Unknown error",
    stack: null,
    cause: cloneForTransport(error)
  };
};

const serializeSnapshot = <TContext extends JourneyJsonObject, TStepId extends string>(
  snapshot: JourneySnapshot<TContext, TStepId>
): JourneyDevtoolsSerializableSnapshot => {
  const byStep: Record<string, JourneyDevtoolsSerializableSnapshot["async"]["byStep"][string]> = {};

  for (const [stepId, stepState] of Object.entries(
    snapshot.async.byStep as Record<string, unknown>
  )) {
    if (!isRecord(stepState)) {
      continue;
    }

    byStep[stepId] = {
      phase:
        stepState.phase === "idle" ||
        stepState.phase === "evaluating-when" ||
        stepState.phase === "error"
          ? stepState.phase
          : "idle",
      eventType: typeof stepState.eventType === "string" ? stepState.eventType : null,
      transitionId: typeof stepState.transitionId === "string" ? stepState.transitionId : null,
      error: stepState.error === null ? null : cloneForTransport(stepState.error)
    };
  }

  return {
    currentStepId: String(snapshot.currentStepId),
    context: cloneForTransport(snapshot.context) as JourneyJsonObject,
    history: {
      timeline: snapshot.history.timeline.map((stepId) => String(stepId)),
      index: snapshot.history.index
    },
    visited: Object.fromEntries(
      Object.entries(snapshot.visited as Record<string, boolean>).map(([stepId, isVisited]) => [
        String(stepId),
        isVisited === true
      ])
    ),
    status: snapshot.status,
    async: {
      isLoading: snapshot.async.isLoading,
      byStep
    }
  };
};

const serializeObservationEvent = <
  TStepId extends string,
  TEventMap extends Record<string, unknown>
>(
  event: JourneyObservationEvent<TStepId, TEventMap>
) => cloneForTransport(event) as Record<string, unknown>;

const toSnapshotOperationResult = <TContext extends JourneyJsonObject, TStepId extends string>(
  result: JourneySendResult<TContext, TStepId>
): JourneyMachineDevtoolsOperationResult<TContext, TStepId> => ({
  kind: "snapshot",
  snapshot: result.snapshot,
  transitioned: result.transitioned,
  ...(result.transitionId ? { transitionId: result.transitionId } : {}),
  ...("error" in result ? { error: result.error } : {})
});

const toSerializableResult = <TContext extends JourneyJsonObject, TStepId extends string>(
  result: JourneyMachineDevtoolsOperationResult<TContext, TStepId>
): JourneyDevtoolsOperationResultPayload => {
  switch (result.kind) {
    case "snapshot":
      return {
        kind: "snapshot",
        snapshot: serializeSnapshot(result.snapshot),
        ...(result.transitioned === undefined ? {} : { transitioned: result.transitioned }),
        ...(result.transitionId === undefined ? {} : { transitionId: result.transitionId }),
        ...(result.error === undefined ? {} : { error: serializeError(result.error) })
      };
    case "data":
      return {
        kind: "data",
        data: cloneForTransport(result.data)
      };
    case "text":
      return result;
    case "void":
      return result;
  }

  const exhaustiveCheck: never = result;
  /* v8 ignore next -- TypeScript exhaustiveness guard for impossible operation result kinds. */
  throw new Error(`Unsupported operation result kind: ${String(exhaustiveCheck)}`);
};

const normalizeDescriptorFeatures = <
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown>,
  TStepMeta,
  THandlers extends Record<string, unknown>
>(
  features: readonly JourneyMachineDevtoolsFeatureSpec<
    TContext,
    TStepId,
    TEventMap,
    TStepMeta,
    THandlers
  >[]
): JourneyDevtoolsMachineFeatureDescriptor[] =>
  features.map((feature) => ({
    id: feature.id,
    label: feature.label,
    description: feature.description ?? null,
    operations: feature.operations.map((operation) => ({
      id: operation.id,
      label: operation.label,
      description: operation.description ?? null,
      mutates: operation.mutates,
      output: operation.output,
      fields: operation.fields ?? []
    }))
  }));

const createCoreFeature = <
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown>,
  TStepMeta,
  THandlers extends Record<string, unknown>
>(
  machine: JourneyMachine<TContext, TStepId, TEventMap, TStepMeta, THandlers>
): JourneyMachineDevtoolsFeatureSpec<TContext, TStepId, TEventMap, TStepMeta, THandlers> => ({
  id: "core",
  label: "Core",
  operations: [
    {
      id: "core.startJourney",
      label: "startJourney",
      mutates: true,
      output: "snapshot",
      run: async () => ({
        kind: "snapshot",
        snapshot: await machine.startJourney()
      })
    },
    {
      id: "core.goToNextStep",
      label: "goToNextStep",
      mutates: true,
      output: "snapshot",
      run: async () => toSnapshotOperationResult(await machine.goToNextStep())
    },
    {
      id: "core.terminateJourney",
      label: "terminateJourney",
      mutates: true,
      output: "snapshot",
      run: async () => toSnapshotOperationResult(await machine.terminateJourney())
    },
    {
      id: "core.completeJourney",
      label: "completeJourney",
      mutates: true,
      output: "snapshot",
      run: async () => toSnapshotOperationResult(await machine.completeJourney())
    },
    {
      id: "core.goToStepById",
      label: "goToStepById",
      mutates: true,
      output: "snapshot",
      fields: [{ key: "stepId", label: "stepId", type: "text", required: true }],
      run: async ({ input }: { input: Record<string, unknown> | undefined }) =>
        toSnapshotOperationResult(await machine.goToStepById(String(input?.stepId) as TStepId))
    },
    {
      id: "core.forceStepTransition",
      label: "forceStepTransition",
      mutates: true,
      output: "snapshot",
      fields: [{ key: "stepId", label: "to", type: "text", required: true }],
      run: async ({ input }: { input: Record<string, unknown> | undefined }) => {
        const stepId = String(input?.stepId) as TStepId;
        const registry = getJourneyMachineDevtoolsRegistry(machine) as
          | {
              controls?: {
                forceStepTransition?: (
                  stepId: TStepId
                ) => Promise<JourneySendResult<TContext, TStepId>>;
              };
            }
          | undefined;
        if (registry?.controls?.forceStepTransition) {
          return toSnapshotOperationResult(await registry.controls.forceStepTransition(stepId));
        }

        return toSnapshotOperationResult(await machine.goToStepById(stepId));
      }
    },
    {
      id: "core.goToPreviousStep",
      label: "goToPreviousStep",
      mutates: true,
      output: "snapshot",
      fields: [{ key: "steps", label: "steps", type: "integer", min: 1 }],
      run: async ({ input }: { input: Record<string, unknown> | undefined }) =>
        toSnapshotOperationResult(
          await machine.goToPreviousStep(
            typeof input?.steps === "number" ? Math.trunc(input.steps) : undefined
          )
        )
    },
    {
      id: "core.goToLastVisitedStep",
      label: "goToLastVisitedStep",
      mutates: true,
      output: "snapshot",
      run: async () => toSnapshotOperationResult(await machine.goToLastVisitedStep())
    },
    {
      id: "core.sendEvent",
      label: "send",
      mutates: true,
      output: "snapshot",
      fields: [
        { key: "type", label: "type", type: "text", required: true },
        { key: "payload", label: "payload", type: "json" }
      ],
      run: async ({ input }: { input: Record<string, unknown> | undefined }) => {
        const eventType = String(input?.type ?? "");
        const event =
          input?.payload === undefined
            ? { type: eventType }
            : { type: eventType, payload: input.payload };
        return toSnapshotOperationResult(
          await machine.send(event as Parameters<typeof machine.send>[0])
        );
      }
    },
    {
      id: "core.updateContext",
      label: "replaceContext",
      mutates: true,
      output: "snapshot",
      fields: [{ key: "context", label: "context", type: "json", required: true }],
      run: async ({ input }: { input: Record<string, unknown> | undefined }) => {
        const nextContext = (input?.context ?? {}) as TContext;
        return {
          kind: "snapshot",
          snapshot: await machine.updateContext(() => nextContext)
        };
      }
    },
    {
      id: "core.patchContext",
      label: "patchContext",
      mutates: true,
      output: "snapshot",
      fields: [
        { key: "key", label: "key", type: "text", required: true },
        { key: "value", label: "value", type: "json", required: true }
      ],
      run: async ({ input }: { input: Record<string, unknown> | undefined }) => {
        const key = String(input?.key ?? "");
        const value = input?.value;

        return {
          kind: "snapshot",
          snapshot: await machine.updateContext(
            (context) =>
              ({
                ...context,
                [key]: value
              }) as TContext
          )
        };
      }
    },
    {
      id: "core.resetJourney",
      label: "resetJourney",
      mutates: true,
      output: "snapshot",
      run: async () => ({
        kind: "snapshot",
        snapshot: await machine.resetJourney()
      })
    },
    {
      id: "core.clearStepError",
      label: "clearStepError",
      mutates: true,
      output: "snapshot",
      fields: [{ key: "stepId", label: "stepId", type: "text" }],
      run: async ({ input }: { input: Record<string, unknown> | undefined }) => ({
        kind: "snapshot",
        snapshot: await machine.clearStepError(
          input?.stepId === undefined ? undefined : (String(input.stepId) as TStepId)
        )
      })
    }
  ]
});

const createOperationRegistry = <
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown>,
  TStepMeta,
  THandlers extends Record<string, unknown>
>(
  machine: JourneyMachine<TContext, TStepId, TEventMap, TStepMeta, THandlers>
) => {
  const registry = getJourneyMachineDevtoolsRegistry(machine);
  if (!registry) {
    throw new Error("Journey machine is missing devtools registry.");
  }

  const features = [createCoreFeature(machine), ...registry.features];
  const stepIds = Object.keys(registry.resolvedJourney.steps);
  const eventTypes = Array.from(
    new Set(
      registry.resolvedJourney.transitions
        .map((transition) => transition.event)
        .filter((eventType) => !BUILT_IN_EVENT_TYPES.has(eventType))
    )
  );
  const mode: JourneyMode =
    registry.journey.transitions === undefined
      ? "headless"
      : Array.isArray(registry.journey.transitions)
        ? "linear"
        : "graph";
  const eventTypesBySource = Object.fromEntries(
    Array.from(
      registry.resolvedJourney.transitions
        .reduce((typesBySource, transition) => {
          if (BUILT_IN_EVENT_TYPES.has(transition.event)) {
            return typesBySource;
          }

          const source = String(transition.from);
          const eventOptions = typesBySource.get(source) ?? new Set<string>();
          eventOptions.add(String(transition.event));
          typesBySource.set(source, eventOptions);
          return typesBySource;
        }, new Map<string, Set<string>>())
        .entries()
    ).map(([source, eventOptions]) => [source, Array.from(eventOptions)])
  );

  const goToStepTargetsBySource = Object.fromEntries(
    Array.from(
      registry.resolvedJourney.transitions
        .reduce((targetsBySource, transition) => {
          if (!("to" in transition) || transition.event !== "goToStepById") {
            return targetsBySource;
          }

          const source = String(transition.from);
          const targets = targetsBySource.get(source) ?? new Set<string>();
          targets.add(String(transition.to));
          targetsBySource.set(source, targets);
          return targetsBySource;
        }, new Map<string, Set<string>>())
        .entries()
    ).map(([source, targets]) => [source, Array.from(targets)])
  );

  const operationMap = new Map<string, OperationRunner<TContext, TStepId>>();

  for (const feature of features) {
    for (const operation of feature.operations) {
      operationMap.set(operation.id, {
        descriptor: {
          id: operation.id,
          label: operation.label,
          description: operation.description ?? null,
          mutates: operation.mutates,
          output: operation.output,
          fields: operation.fields ?? []
        },
        run: async (input) =>
          operation.run({
            machine,
            input,
            journey: registry.journey,
            resolvedJourney: registry.resolvedJourney
          })
      });
    }
  }

  return {
    eventTypesBySource,
    eventTypes,
    features: normalizeDescriptorFeatures(features),
    goToStepTargetsBySource,
    mode,
    operations: operationMap,
    stepIds
  };
};

/** Attaches the browser devtools bridge to a journey machine and returns a detach cleanup. */
export const attachJourneyDevtools = <
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown> = Record<never, never>,
  TStepMeta = unknown,
  THandlers extends Record<string, unknown> = Record<never, never>
>(
  machine: JourneyMachine<TContext, TStepId, TEventMap, TStepMeta, THandlers>,
  options: JourneyDevtoolsBridgeOptions = {}
): (() => void) => {
  const enabled = options.enabled ?? resolveNonProductionEnvironment();
  if (!enabled || typeof window === "undefined") {
    return () => {};
  }

  const machineId = options.machineId?.trim() || createJourneyMachineId();
  const label = options.label?.trim() || DEFAULT_MACHINE_LABEL;
  const appName =
    options.appName?.trim() || (typeof document !== "undefined" ? document.title || null : null);
  const mutationsEnabled =
    options.mutationsEnabled ?? options.commandsEnabled ?? resolveNonProductionEnvironment();
  const operationRegistry = createOperationRegistry(machine);
  const rateLimiter = new OperationRateLimiter();
  const targetOrigin = resolveWindowTargetOrigin();

  const postEnvelope = (envelope: JourneyDevtoolsBridgeEnvelope) => {
    window.postMessage(envelope, targetOrigin);
  };

  const emitRegister = () => {
    postEnvelope({
      channel: JOURNEY_DEVTOOLS_CHANNEL,
      version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
      source: JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
      kind: "register",
      machineId,
      timestamp: Date.now(),
      meta: {
        machineId,
        label,
        appName,
        mutationsEnabled,
        mode: operationRegistry.mode,
        stepIds: operationRegistry.stepIds,
        eventTypes: operationRegistry.eventTypes,
        eventTypesBySource: operationRegistry.eventTypesBySource,
        goToStepTargetsBySource: operationRegistry.goToStepTargetsBySource,
        features: operationRegistry.features
      },
      snapshot: serializeSnapshot(machine.getSnapshot())
    } satisfies JourneyDevtoolsBridgeRegisterEnvelope);
  };

  const emitSnapshot = () => {
    postEnvelope({
      channel: JOURNEY_DEVTOOLS_CHANNEL,
      version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
      source: JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
      kind: "snapshot",
      machineId,
      timestamp: Date.now(),
      snapshot: serializeSnapshot(machine.getSnapshot())
    } satisfies JourneyDevtoolsBridgeSnapshotEnvelope);
  };

  emitRegister();

  const unsubscribeSnapshot = machine.subscribe(() => {
    emitSnapshot();
  });

  const unsubscribeEvents = machine.subscribeEvent((event) => {
    postEnvelope({
      channel: JOURNEY_DEVTOOLS_CHANNEL,
      version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
      source: JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
      kind: "observation",
      machineId,
      timestamp: Date.now(),
      event: serializeObservationEvent(
        event as JourneyObservationEvent<string, Record<string, unknown>>
      )
    } satisfies JourneyDevtoolsBridgeObservationEnvelope);
  });

  const handleInvocation = async (
    requestId: string,
    invocation: JourneyDevtoolsOperationInvoke
  ) => {
    const runner = operationRegistry.operations.get(invocation.operationId);
    if (!runner) {
      postEnvelope({
        channel: JOURNEY_DEVTOOLS_CHANNEL,
        version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
        source: JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
        kind: "operationError",
        machineId,
        timestamp: Date.now(),
        requestId,
        operationId: invocation.operationId,
        error: serializeError(new Error(`Unknown operation "${invocation.operationId}".`))
      } satisfies JourneyDevtoolsBridgeOperationErrorEnvelope);
      return;
    }

    if (!mutationsEnabled && runner.descriptor.mutates) {
      postEnvelope({
        channel: JOURNEY_DEVTOOLS_CHANNEL,
        version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
        source: JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
        kind: "operationError",
        machineId,
        timestamp: Date.now(),
        requestId,
        operationId: invocation.operationId,
        error: serializeError(new Error("Mutating devtools operations are disabled."))
      } satisfies JourneyDevtoolsBridgeOperationErrorEnvelope);
      return;
    }

    try {
      const result = await runner.run(invocation.input);
      postEnvelope({
        channel: JOURNEY_DEVTOOLS_CHANNEL,
        version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
        source: JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
        kind: "operationResult",
        machineId,
        timestamp: Date.now(),
        requestId,
        operationId: invocation.operationId,
        result: toSerializableResult(result)
      } satisfies JourneyDevtoolsBridgeOperationResultEnvelope);
    } catch (error) {
      postEnvelope({
        channel: JOURNEY_DEVTOOLS_CHANNEL,
        version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
        source: JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
        kind: "operationError",
        machineId,
        timestamp: Date.now(),
        requestId,
        operationId: invocation.operationId,
        error: serializeError(error)
      } satisfies JourneyDevtoolsBridgeOperationErrorEnvelope);
    }
  };

  const onMessage = (event: MessageEvent<unknown>) => {
    if (
      event.source === window &&
      isExpectedWindowOrigin(event.origin) &&
      isReplayRequestMessage(event.data)
    ) {
      emitRegister();
      emitSnapshot();
      return;
    }

    if (
      event.source !== window ||
      !isExpectedWindowOrigin(event.origin) ||
      !isJourneyDevtoolsEnvelope(event.data) ||
      event.data.source !== JOURNEY_DEVTOOLS_EXTENSION_SOURCE ||
      event.data.kind !== "invoke" ||
      event.data.machineId !== machineId
    ) {
      return;
    }

    if (!rateLimiter.isAllowed()) {
      postEnvelope({
        channel: JOURNEY_DEVTOOLS_CHANNEL,
        version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
        source: JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
        kind: "operationError",
        machineId,
        timestamp: Date.now(),
        requestId: event.data.requestId,
        operationId: event.data.invocation.operationId,
        error: serializeError(new Error("Devtools operation rate limit exceeded."))
      } satisfies JourneyDevtoolsBridgeOperationErrorEnvelope);
      return;
    }

    void handleInvocation(event.data.requestId, event.data.invocation);
  };

  window.addEventListener("message", onMessage);

  return () => {
    unsubscribeSnapshot();
    unsubscribeEvents();
    window.removeEventListener("message", onMessage);
    rateLimiter.reset();
    postEnvelope({
      channel: JOURNEY_DEVTOOLS_CHANNEL,
      version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
      source: JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
      kind: "unregister",
      machineId,
      timestamp: Date.now()
    } satisfies JourneyDevtoolsBridgeUnregisterEnvelope);
  };
};
