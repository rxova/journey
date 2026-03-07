import type {
  JourneyEventPayloadMap,
  JourneyMachine,
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
  type JourneyDevtoolsBridgeRegisterEnvelope,
  type JourneyDevtoolsBridgeSnapshotEnvelope,
  type JourneyDevtoolsBridgeUnregisterEnvelope,
  type JourneyDevtoolsCommand,
  type JourneyDevtoolsExtensionCommandEnvelope,
  type JourneyDevtoolsMachineMeta,
  type JourneyDevtoolsSerializableSnapshot,
  type JourneyDevtoolsSerializedError
} from "./protocol";

declare const process: { env?: { NODE_ENV?: string } } | undefined;

export type JourneyDevtoolsBridgeOptions = {
  machineId?: string;
  label?: string;
  enabled?: boolean;
  appName?: string;
  commandsEnabled?: boolean;
};

type SendOutcome<TContext, TStepId extends string, TStepMeta> = {
  snapshot: JourneySnapshot<TContext, TStepId, TStepMeta>;
  transitioned?: boolean;
  transitionId?: string;
  error?: JourneyDevtoolsSerializedError;
};

type SnapshotScheduleKind = "raf" | "timeout";

const DEFAULT_MACHINE_LABEL = "Journey Machine";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isJourneyAsyncPhase = (
  value: unknown
): value is JourneyDevtoolsSerializableSnapshot["async"]["byStep"][string]["phase"] =>
  value === "idle" ||
  value === "evaluating-when" ||
  value === "running-effect" ||
  value === "error";

type JourneyImportMetaEnv = {
  DEV?: unknown;
  PROD?: unknown;
};

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

// No session token infrastructure needed

/**
 * Validates that the message origin matches the current window origin.
 * This prevents messages from other origins from being processed.
 *
 * Note: This is part of defense-in-depth but not a hard security boundary.
 * Code running in the same origin can still send messages.
 */
const isExpectedWindowOrigin = (origin: string): boolean => {
  if (origin.length === 0) {
    return false;
  }

  if (typeof window === "undefined") {
    return false;
  }

  const expected = window.location.origin;
  if (expected === "null") {
    // For file:// or sandboxed contexts where origin is "null"
    return origin === "null";
  }

  // Strict equality check - no wildcard matching
  return origin === expected;
};

const createMachineId = (): string =>
  `journey-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/**
 * Simple rate limiter to prevent command abuse.
 * Tracks command timestamps and enforces a maximum rate.
 */
class CommandRateLimiter {
  private commandTimestamps: number[] = [];
  private readonly maxCommandsPerWindow: number;
  private readonly windowMs: number;

  constructor(maxCommandsPerWindow = 100, windowMs = 10000) {
    this.maxCommandsPerWindow = maxCommandsPerWindow;
    this.windowMs = windowMs;
  }

  /**
   * Checks if a command is allowed based on rate limits.
   * Returns true if allowed, false if rate limit exceeded.
   */
  isAllowed(): boolean {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    // Remove old timestamps outside the window
    this.commandTimestamps = this.commandTimestamps.filter((ts) => ts > windowStart);

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

const serializeSnapshot = <TContext, TStepId extends string, TStepMeta>(
  snapshot: JourneySnapshot<TContext, TStepId, TStepMeta>
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
    context: cloneForTransport(snapshot.context),
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
    stepMeta: cloneForTransport(snapshot.stepMeta) as Record<string, unknown>,
    status: snapshot.status,
    async: {
      isLoading: snapshot.async.isLoading,
      byStep
    }
  };
};

const isKnownStepId = <TContext, TStepId extends string, TStepMeta>(
  snapshot: JourneySnapshot<TContext, TStepId, TStepMeta>,
  stepId: string
): stepId is TStepId => stepId in snapshot.stepMeta;

const assertKnownStepId = <TContext, TStepId extends string, TStepMeta>(
  machine: JourneyMachine<TContext, TStepId, string, Record<never, never>, TStepMeta>,
  stepId: string,
  commandType: JourneyDevtoolsCommand["type"]
): TStepId => {
  if (!isKnownStepId(machine.getSnapshot(), stepId)) {
    throw new Error(`Unknown stepId "${stepId}" for "${commandType}" command.`);
  }
  return stepId;
};

const toSendOutcome = <TContext, TStepId extends string, TStepMeta>(
  result: JourneySendResult<TContext, TStepId, TStepMeta>
): SendOutcome<TContext, TStepId, TStepMeta> => ({
  snapshot: result.snapshot,
  transitioned: result.transitioned,
  ...(result.transitionId ? { transitionId: result.transitionId } : {}),
  ...("error" in result ? { error: serializeError(result.error) } : {})
});

const runCommand = async <TContext, TStepId extends string, TStepMeta>(
  machine: JourneyMachine<TContext, TStepId, string, Record<never, never>, TStepMeta>,
  command: JourneyDevtoolsCommand
): Promise<SendOutcome<TContext, TStepId, TStepMeta>> => {
  switch (command.type) {
    case "goToNextStep":
    case "completeJourney": {
      const result = await machine.send({ type: command.type });
      return toSendOutcome(result);
    }
    case "terminateMachine": {
      const result = await machine.send({ type: "terminateJourney" });
      return toSendOutcome(result);
    }
    case "goToStepById": {
      const stepId = assertKnownStepId(machine, command.stepId, command.type);
      const result = await machine.send({
        type: "goToStepById",
        stepId
      });
      return toSendOutcome(result);
    }
    case "goToPreviousStep": {
      const result = await machine.goToPreviousStep(command.steps);
      return toSendOutcome(result);
    }
    case "goToLastVisitedStep": {
      const result = await machine.goToLastVisitedStep();
      return toSendOutcome(result);
    }
    case "send": {
      const sendEvent =
        command.event.payload === undefined
          ? { type: command.event.type }
          : { type: command.event.type, payload: command.event.payload };
      const result: JourneySendResult<TContext, TStepId, TStepMeta> = await machine.send(sendEvent);
      return toSendOutcome(result);
    }
    case "updateStepMetadata": {
      const stepId = assertKnownStepId(machine, command.stepId, command.type);
      return {
        snapshot: machine.updateStepMetadata(stepId, () => command.metadata as TStepMeta)
      };
    }
    case "resetMachine":
      return {
        snapshot: machine.resetMachine()
      };
    case "clearStepError": {
      const stepId =
        command.stepId === undefined
          ? undefined
          : assertKnownStepId(machine, command.stepId, command.type);
      return {
        snapshot: machine.clearStepError(stepId)
      };
    }
  }
};

/**
 * Attaches a journey machine to the browser devtools transport and returns
 * a detach function that unsubscribes listeners and unregisters the machine.
 */
export const attachJourneyDevtools = <
  TContext,
  TStepId extends string,
  TEventType extends string,
  TPayloadMap extends JourneyEventPayloadMap<TEventType>,
  TStepMeta
>(
  machine: JourneyMachine<TContext, TStepId, TEventType, TPayloadMap, TStepMeta>,
  options: JourneyDevtoolsBridgeOptions = {}
): (() => void) => {
  const enabled = options.enabled ?? resolveNonProductionEnvironment();
  if (!enabled || typeof window === "undefined") {
    return () => {};
  }
  const commandsEnabled = options.commandsEnabled ?? resolveNonProductionEnvironment();

  const machineId = options.machineId?.trim() || createMachineId();
  const meta: JourneyDevtoolsMachineMeta = {
    machineId,
    label: options.label?.trim() || DEFAULT_MACHINE_LABEL,
    appName:
      options.appName?.trim() || (typeof document !== "undefined" ? document.title : "") || null,
    commandsEnabled
  };
  const targetOrigin = resolveWindowTargetOrigin();

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

  const postSnapshot = (snapshot: JourneySnapshot<TContext, TStepId, TStepMeta>) => {
    const envelope: JourneyDevtoolsBridgeSnapshotEnvelope = {
      ...createBaseEnvelope("snapshot"),
      snapshot: serializeSnapshot(snapshot)
    };
    post(envelope);
  };

  let isDetached = false;
  const rateLimiter = new CommandRateLimiter();
  let pendingSnapshot: JourneySnapshot<TContext, TStepId, TStepMeta> | null = null;
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

  const scheduleSnapshotPost = (snapshot: JourneySnapshot<TContext, TStepId, TStepMeta>) => {
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

    // Rate limiting to prevent command abuse
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

    if (!commandsEnabled) {
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
          machine as JourneyMachine<TContext, TStepId, string, Record<never, never>, TStepMeta>,
          commandEnvelope.command
        );
        if (isDetached) {
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

  const unsubscribe = machine.subscribe(() => {
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

  return () => {
    if (isDetached) {
      return;
    }

    isDetached = true;
    rateLimiter.reset();
    unsubscribe();
    window.removeEventListener("message", onMessage);
    cancelScheduledSnapshot();

    const unregisterEnvelope: JourneyDevtoolsBridgeUnregisterEnvelope = {
      ...createBaseEnvelope("unregister")
    };
    post(unregisterEnvelope);
  };
};
