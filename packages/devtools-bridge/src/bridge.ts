import type {
  JourneyExecutionPathOptions,
  JourneyExecutionPathsResult,
  JourneyJsonObject,
  JourneyMachine,
  JourneyObservationEvent,
  JourneySendResult,
  JourneySnapshot
} from "@rxova/journey-core";
import {
  JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
  JOURNEY_DEVTOOLS_CHANNEL,
  JOURNEY_DEVTOOLS_EXTENSION_SOURCE,
  JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
  isJourneyDevtoolsEnvelope,
  type JourneyDevtoolsBridgeCommandErrorEnvelope,
  type JourneyDevtoolsBridgeCommandResultEnvelope,
  type JourneyDevtoolsBridgeEnvelope,
  type JourneyDevtoolsBridgeExecutionPathsResultEnvelope,
  type JourneyDevtoolsBridgeObservationEnvelope,
  type JourneyDevtoolsBridgeRegisterEnvelope,
  type JourneyDevtoolsBridgeSnapshotEnvelope,
  type JourneyDevtoolsBridgeUnregisterEnvelope,
  type JourneyDevtoolsCommand,
  type JourneyDevtoolsExtensionCommandEnvelope,
  type JourneyDevtoolsMachineMeta,
  type JourneyDevtoolsSerializableExecutionPathsResult,
  type JourneyDevtoolsSerializableObservationEvent,
  type JourneyDevtoolsSerializableSnapshot,
  type JourneyDevtoolsSerializedError
} from "./protocol";

declare const process: { env?: { NODE_ENV?: string } } | undefined;

type JourneyDevtoolsPersistencePluginMetadata = {
  key?: string;
  clearOnReset?: boolean;
};

export type JourneyDevtoolsBridgeOptions = {
  machineId?: string;
  label?: string;
  enabled?: boolean;
  appName?: string;
  commandsEnabled?: boolean;
  pluginMetadata?: {
    persistence?: JourneyDevtoolsPersistencePluginMetadata;
  };
};

type SnapshotCommandOutcome<TContext extends JourneyJsonObject, TStepId extends string> = {
  kind: "snapshot";
  snapshot: JourneySnapshot<TContext, TStepId>;
  transitioned?: boolean;
  transitionId?: string;
  error?: JourneyDevtoolsSerializedError;
};

type ExecutionPathsCommandOutcome<TStepId extends string, TEventType extends string> = {
  kind: "executionPaths";
  result: JourneyExecutionPathsResult<TStepId, TEventType>;
};

type CommandOutcome<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventType extends string
> = SnapshotCommandOutcome<TContext, TStepId> | ExecutionPathsCommandOutcome<TStepId, TEventType>;

type SnapshotScheduleKind = "raf" | "timeout";

type JourneyImportMetaEnv = {
  DEV?: unknown;
  PROD?: unknown;
};

type ExecutionPathsJourneyMachine<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown>,
  TStepMeta,
  THandlers extends Record<string, unknown>
> = JourneyMachine<TContext, TStepId, TEventMap, TStepMeta, THandlers> & {
  getExecutionPaths: (
    options?: JourneyExecutionPathOptions
  ) => JourneyExecutionPathsResult<TStepId, string>;
};

const DEFAULT_MACHINE_LABEL = "Journey Machine";
const MUTATING_COMMAND_TYPES = [
  "startJourney",
  "goToNextStep",
  "terminateJourney",
  "completeJourney",
  "goToStepById",
  "goToPreviousStep",
  "goToLastVisitedStep",
  "send",
  "resetJourney",
  "clearStepError"
] as const satisfies readonly Exclude<JourneyDevtoolsCommand["type"], "getExecutionPaths">[];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isJourneyAsyncPhase = (
  value: unknown
): value is JourneyDevtoolsSerializableSnapshot["async"]["byStep"][string]["phase"] =>
  value === "idle" || value === "evaluating-when" || value === "error";

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
  if (typeof window === "undefined") {
    return "*";
  }

  return window.location.origin === "null" ? "*" : window.location.origin;
};

const isExpectedWindowOrigin = (origin: string): boolean => {
  if (origin.length === 0) {
    return false;
  }

  if (typeof window === "undefined") {
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

class CommandRateLimiter {
  private commandTimestamps: number[] = [];
  private readonly maxCommandsPerWindow: number;
  private readonly windowMs: number;

  constructor(maxCommandsPerWindow = 100, windowMs = 10000) {
    this.maxCommandsPerWindow = maxCommandsPerWindow;
    this.windowMs = windowMs;
  }

  isAllowed(): boolean {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    this.commandTimestamps = this.commandTimestamps.filter((timestamp) => timestamp > windowStart);

    if (this.commandTimestamps.length >= this.maxCommandsPerWindow) {
      return false;
    }

    this.commandTimestamps.push(now);
    return true;
  }

  reset(): void {
    this.commandTimestamps = [];
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

    if (serialized === undefined) {
      return undefined;
    }

    return JSON.parse(serialized) as unknown;
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
      phase: isJourneyAsyncPhase(stepState.phase) ? stepState.phase : "idle",
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
): JourneyDevtoolsSerializableObservationEvent => {
  if (event.type === "transition.error") {
    return cloneForTransport({
      ...event,
      error: serializeError(event.error)
    }) as JourneyDevtoolsSerializableObservationEvent;
  }
  return cloneForTransport(event) as JourneyDevtoolsSerializableObservationEvent;
};

const serializeExecutionPathsResult = <TStepId extends string, TEventType extends string>(
  result: JourneyExecutionPathsResult<TStepId, TEventType>
): JourneyDevtoolsSerializableExecutionPathsResult =>
  cloneForTransport(result) as JourneyDevtoolsSerializableExecutionPathsResult;

const isKnownStepId = <TContext extends JourneyJsonObject, TStepId extends string>(
  snapshot: JourneySnapshot<TContext, TStepId>,
  stepId: string
): stepId is TStepId => stepId in (snapshot.async.byStep as Record<string, unknown>);

const assertKnownStepId = <TContext extends JourneyJsonObject, TStepId extends string>(
  machine: { getSnapshot: () => JourneySnapshot<TContext, TStepId> },
  stepId: string,
  commandType: JourneyDevtoolsCommand["type"]
): TStepId => {
  if (!isKnownStepId(machine.getSnapshot(), stepId)) {
    throw new Error(`Unknown stepId "${stepId}" for "${commandType}" command.`);
  }
  return stepId;
};

const toSnapshotCommandOutcome = <TContext extends JourneyJsonObject, TStepId extends string>(
  result: JourneySendResult<TContext, TStepId>
): SnapshotCommandOutcome<TContext, TStepId> => ({
  kind: "snapshot",
  snapshot: result.snapshot,
  transitioned: result.transitioned,
  ...(result.transitionId ? { transitionId: result.transitionId } : {}),
  ...("error" in result ? { error: serializeError(result.error) } : {})
});

const hasExecutionPathsSupport = <
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown>,
  TStepMeta,
  THandlers extends Record<string, unknown>
>(
  machine: JourneyMachine<TContext, TStepId, TEventMap, TStepMeta, THandlers>
): machine is ExecutionPathsJourneyMachine<TContext, TStepId, TEventMap, TStepMeta, THandlers> =>
  typeof (machine as Record<string, unknown>).getExecutionPaths === "function";

const isReadOnlyCommand = (command: JourneyDevtoolsCommand): boolean =>
  command.type === "getExecutionPaths";

const createCapabilities = <
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown>,
  TStepMeta,
  THandlers extends Record<string, unknown>
>(
  machine: JourneyMachine<TContext, TStepId, TEventMap, TStepMeta, THandlers>,
  options: JourneyDevtoolsBridgeOptions,
  commandsEnabled: boolean
) => {
  const executionPaths = hasExecutionPathsSupport(machine);
  const commands: JourneyDevtoolsCommand["type"][] = [];

  if (commandsEnabled) {
    commands.push(...MUTATING_COMMAND_TYPES);
  }

  if (executionPaths) {
    commands.push("getExecutionPaths");
  }

  return {
    commands,
    observe: true as const,
    executionPaths,
    ...(options.pluginMetadata?.persistence
      ? {
          persistence: {
            key: options.pluginMetadata.persistence.key?.trim() || null,
            clearOnReset:
              typeof options.pluginMetadata.persistence.clearOnReset === "boolean"
                ? options.pluginMetadata.persistence.clearOnReset
                : null
          }
        }
      : {})
  };
};

const runCommand = async <
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TStepMeta,
  THandlers extends Record<string, unknown>
>(
  machine: JourneyMachine<TContext, TStepId, Record<never, never>, TStepMeta, THandlers>,
  command: JourneyDevtoolsCommand
): Promise<CommandOutcome<TContext, TStepId, string>> => {
  switch (command.type) {
    case "startJourney":
      return {
        kind: "snapshot",
        snapshot: await machine.start()
      };
    case "goToNextStep":
    case "completeJourney": {
      const result = await machine.send({ type: command.type });
      return toSnapshotCommandOutcome(result);
    }
    case "terminateJourney": {
      const result = await machine.send({ type: "terminateJourney" });
      return toSnapshotCommandOutcome(result);
    }
    case "goToStepById": {
      const stepId = assertKnownStepId(machine, command.stepId, command.type);
      const result = await machine.send({
        type: "goToStepById",
        stepId
      });
      return toSnapshotCommandOutcome(result);
    }
    case "goToPreviousStep": {
      const result = await machine.goToPreviousStep(command.steps);
      return toSnapshotCommandOutcome(result);
    }
    case "goToLastVisitedStep": {
      const result = await machine.goToLastVisitedStep();
      return toSnapshotCommandOutcome(result);
    }
    case "send": {
      const sendEvent =
        command.event.payload === undefined
          ? { type: command.event.type }
          : { type: command.event.type, payload: command.event.payload };
      const result: JourneySendResult<TContext, TStepId> = await machine.send(
        sendEvent as Parameters<typeof machine.send>[0]
      );
      return toSnapshotCommandOutcome(result);
    }
    case "resetJourney":
      return {
        kind: "snapshot",
        snapshot: await machine.resetJourney()
      };
    case "clearStepError": {
      const stepId =
        command.stepId === undefined
          ? undefined
          : assertKnownStepId(machine, command.stepId, command.type);
      return {
        kind: "snapshot",
        snapshot: await machine.clearStepError(stepId)
      };
    }
    case "getExecutionPaths": {
      if (!hasExecutionPathsSupport(machine)) {
        throw new Error('Machine does not support "getExecutionPaths".');
      }

      return {
        kind: "executionPaths",
        result: machine.getExecutionPaths(command.options)
      };
    }
  }
};

/**
 * Attaches a journey machine to the browser devtools transport and returns
 * a detach function that unsubscribes listeners and unregisters the machine.
 */
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

  const commandsEnabled = options.commandsEnabled ?? resolveNonProductionEnvironment();
  const machineId = options.machineId?.trim() || createJourneyMachineId();
  const targetOrigin = resolveWindowTargetOrigin();
  const capabilities = createCapabilities(machine, options, commandsEnabled);

  const meta: JourneyDevtoolsMachineMeta = {
    machineId,
    label: options.label?.trim() || DEFAULT_MACHINE_LABEL,
    appName:
      options.appName?.trim() || (typeof document !== "undefined" ? document.title : "") || null,
    commandsEnabled,
    capabilities
  };

  const createBaseEnvelope = <TKind extends JourneyDevtoolsBridgeEnvelope["kind"]>(
    kind: TKind
  ) => ({
    channel: JOURNEY_DEVTOOLS_CHANNEL,
    version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
    source: JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
    kind,
    machineId,
    timestamp: Date.now()
  });

  const post = (envelope: JourneyDevtoolsBridgeEnvelope) => {
    try {
      window.postMessage(envelope, targetOrigin);
    } catch {
      // Swallow transport failures so bridge lifecycle and commands remain non-throwing.
    }
  };

  const postSnapshot = (snapshot: JourneySnapshot<TContext, TStepId>) => {
    const envelope: JourneyDevtoolsBridgeSnapshotEnvelope = {
      ...createBaseEnvelope("snapshot"),
      snapshot: serializeSnapshot(snapshot)
    };
    post(envelope);
  };

  const postObservation = (event: JourneyObservationEvent<TStepId, TEventMap>) => {
    const envelope: JourneyDevtoolsBridgeObservationEnvelope = {
      ...createBaseEnvelope("observation"),
      event: serializeObservationEvent(event)
    };
    post(envelope);
  };

  const postExecutionPathsResult = (
    requestId: string,
    result: JourneyExecutionPathsResult<TStepId, string>
  ) => {
    const envelope: JourneyDevtoolsBridgeExecutionPathsResultEnvelope = {
      ...createBaseEnvelope("executionPathsResult"),
      requestId,
      result: serializeExecutionPathsResult(result)
    };
    post(envelope);
  };

  let isDetached = false;
  const rateLimiter = new CommandRateLimiter();
  let pendingSnapshot: JourneySnapshot<TContext, TStepId> | null = null;
  let scheduledSnapshotHandle: number | ReturnType<typeof globalThis.setTimeout> | null = null;
  let scheduledSnapshotKind: SnapshotScheduleKind | null = null;

  const clearScheduledSnapshotState = () => {
    pendingSnapshot = null;
    scheduledSnapshotHandle = null;
    scheduledSnapshotKind = null;
  };

  const flushScheduledSnapshot = () => {
    const snapshot = pendingSnapshot;
    clearScheduledSnapshotState();

    if (!snapshot || isDetached) {
      return;
    }

    postSnapshot(snapshot);
  };

  const scheduleSnapshotPost = (snapshot: JourneySnapshot<TContext, TStepId>) => {
    pendingSnapshot = snapshot;
    if (scheduledSnapshotHandle !== null) {
      return;
    }

    if (typeof window.requestAnimationFrame === "function") {
      scheduledSnapshotKind = "raf";
      scheduledSnapshotHandle = window.requestAnimationFrame(() => {
        flushScheduledSnapshot();
      });
      return;
    }

    scheduledSnapshotKind = "timeout";
    scheduledSnapshotHandle = globalThis.setTimeout(() => {
      flushScheduledSnapshot();
    }, 0);
  };

  const cancelScheduledSnapshot = () => {
    if (scheduledSnapshotHandle === null) {
      clearScheduledSnapshotState();
      return;
    }

    if (scheduledSnapshotKind === "raf" && typeof window.cancelAnimationFrame === "function") {
      window.cancelAnimationFrame(scheduledSnapshotHandle as number);
    } else {
      globalThis.clearTimeout(scheduledSnapshotHandle);
    }

    clearScheduledSnapshotState();
  };

  const onMessage = (event: MessageEvent<unknown>) => {
    if (
      event.source !== window ||
      !isExpectedWindowOrigin(event.origin) ||
      isDetached ||
      !isJourneyDevtoolsEnvelope(event.data)
    ) {
      return;
    }

    if (event.data.source !== JOURNEY_DEVTOOLS_EXTENSION_SOURCE || event.data.kind !== "command") {
      return;
    }

    const commandEnvelope: JourneyDevtoolsExtensionCommandEnvelope = event.data;
    if (commandEnvelope.machineId !== machineId) {
      return;
    }

    if (!rateLimiter.isAllowed()) {
      const errorEnvelope: JourneyDevtoolsBridgeCommandErrorEnvelope = {
        ...createBaseEnvelope("commandError"),
        requestId: commandEnvelope.requestId,
        error: serializeError(
          "Command rate limit exceeded. Too many commands in a short time window."
        )
      };
      post(errorEnvelope);
      return;
    }

    if (!commandsEnabled && !isReadOnlyCommand(commandEnvelope.command)) {
      const errorEnvelope: JourneyDevtoolsBridgeCommandErrorEnvelope = {
        ...createBaseEnvelope("commandError"),
        requestId: commandEnvelope.requestId,
        error: serializeError("Bridge commands are disabled by configuration.")
      };
      post(errorEnvelope);
      return;
    }

    const run = async () => {
      try {
        const outcome = await runCommand(
          machine as unknown as JourneyMachine<
            TContext,
            TStepId,
            Record<never, never>,
            TStepMeta,
            THandlers
          >,
          commandEnvelope.command
        );

        if (isDetached) {
          return;
        }

        if (outcome.kind === "executionPaths") {
          postExecutionPathsResult(commandEnvelope.requestId, outcome.result);
          return;
        }

        const resultEnvelope: JourneyDevtoolsBridgeCommandResultEnvelope = {
          ...createBaseEnvelope("commandResult"),
          requestId: commandEnvelope.requestId,
          snapshot: serializeSnapshot(outcome.snapshot),
          ...(outcome.transitioned !== undefined ? { transitioned: outcome.transitioned } : {}),
          ...(outcome.transitionId ? { transitionId: outcome.transitionId } : {}),
          ...("error" in outcome ? { error: outcome.error } : {})
        };
        post(resultEnvelope);
      } catch (error) {
        if (isDetached) {
          return;
        }

        const errorEnvelope: JourneyDevtoolsBridgeCommandErrorEnvelope = {
          ...createBaseEnvelope("commandError"),
          requestId: commandEnvelope.requestId,
          error: serializeError(error)
        };
        post(errorEnvelope);
      }
    };

    void run();
  };

  window.addEventListener("message", onMessage);

  const unsubscribeSnapshot = machine.subscribe(() => {
    if (isDetached) {
      return;
    }

    scheduleSnapshotPost(machine.getSnapshot());
  });

  const registerEnvelope: JourneyDevtoolsBridgeRegisterEnvelope = {
    ...createBaseEnvelope("register"),
    meta,
    snapshot: serializeSnapshot(machine.getSnapshot())
  };
  post(registerEnvelope);

  const unsubscribeObservation = machine.subscribeEvent((event) => {
    if (isDetached) {
      return;
    }

    postObservation(event);
  });

  return () => {
    if (isDetached) {
      return;
    }

    isDetached = true;
    rateLimiter.reset();
    unsubscribeObservation();
    unsubscribeSnapshot();
    window.removeEventListener("message", onMessage);
    cancelScheduledSnapshot();

    const unregisterEnvelope: JourneyDevtoolsBridgeUnregisterEnvelope = {
      ...createBaseEnvelope("unregister")
    };
    post(unregisterEnvelope);
  };
};
