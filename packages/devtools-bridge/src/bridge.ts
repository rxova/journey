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

type JourneySendEvent<TStepId extends string> = Parameters<
  JourneyMachine<unknown, TStepId, string, Record<never, never>, unknown>["send"]
>[0];

type SendOutcome<TContext, TStepId extends string, TStepMeta> = {
  snapshot: JourneySnapshot<TContext, TStepId, TStepMeta>;
  transitioned?: boolean;
  transitionId?: string;
};

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

const resolveDefaultEnabled = (): boolean => {
  const nodeEnv = typeof process !== "undefined" ? process.env?.NODE_ENV : undefined;
  if (typeof nodeEnv !== "string") {
    return false;
  }

  return nodeEnv !== "production";
};

const resolveDefaultCommandsEnabled = (): boolean => {
  const nodeEnv = typeof process !== "undefined" ? process.env?.NODE_ENV : undefined;
  if (typeof nodeEnv !== "string") {
    return false;
  }

  return nodeEnv !== "production";
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
  if (typeof structuredClone === "function") {
    try {
      return structuredClone(value);
    } catch {
      // Fall through to the JSON serializer below.
    }
  }

  const seen = new WeakSet<object>();

  try {
    const serialized = JSON.stringify(value, (_key, currentValue) => {
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

const runCommand = async <TContext, TStepId extends string, TStepMeta>(
  machine: JourneyMachine<TContext, TStepId, string, Record<never, never>, TStepMeta>,
  command: JourneyDevtoolsCommand
): Promise<SendOutcome<TContext, TStepId, TStepMeta>> => {
  switch (command.type) {
    case "goToNextStep":
    case "completeJourney": {
      const result = await machine.send({ type: command.type } as JourneySendEvent<TStepId>);
      return {
        snapshot: result.snapshot,
        transitioned: result.transitioned,
        ...(result.transitionId ? { transitionId: result.transitionId } : {})
      };
    }
    case "terminateMachine": {
      const result = await machine.send({ type: "terminateJourney" } as JourneySendEvent<TStepId>);
      return {
        snapshot: result.snapshot,
        transitioned: result.transitioned,
        ...(result.transitionId ? { transitionId: result.transitionId } : {})
      };
    }
    case "goToStepById": {
      const result = await machine.send({
        type: "goToStepById",
        stepId: command.stepId
      } as JourneySendEvent<TStepId>);
      return {
        snapshot: result.snapshot,
        transitioned: result.transitioned,
        ...(result.transitionId ? { transitionId: result.transitionId } : {})
      };
    }
    case "goToPreviousStep": {
      const result = await machine.goToPreviousStep(command.steps);
      return {
        snapshot: result.snapshot,
        transitioned: result.transitioned,
        ...(result.transitionId ? { transitionId: result.transitionId } : {})
      };
    }
    case "goToLastVisitedStep": {
      const result = await machine.goToLastVisitedStep();
      return {
        snapshot: result.snapshot,
        transitioned: result.transitioned,
        ...(result.transitionId ? { transitionId: result.transitionId } : {})
      };
    }
    case "send": {
      const sendEvent =
        command.event.payload === undefined
          ? { type: command.event.type }
          : { type: command.event.type, payload: command.event.payload };
      const result: JourneySendResult<TContext, TStepId, TStepMeta> = await machine.send(
        sendEvent as JourneySendEvent<TStepId>
      );
      return {
        snapshot: result.snapshot,
        transitioned: result.transitioned,
        ...(result.transitionId ? { transitionId: result.transitionId } : {})
      };
    }
    case "updateStepMetadata":
      return {
        snapshot: machine.updateStepMetadata(
          command.stepId as TStepId,
          () => command.metadata as TStepMeta
        )
      };
    case "resetMachine":
      return {
        snapshot: machine.resetMachine()
      };
    case "clearStepError":
      return {
        snapshot: machine.clearStepError(command.stepId as TStepId | undefined)
      };
  }
};

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
  const enabled = options.enabled ?? resolveDefaultEnabled();
  if (!enabled || typeof window === "undefined") {
    return () => {};
  }
  const commandsEnabled = options.commandsEnabled ?? resolveDefaultCommandsEnabled();

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
    window.postMessage(envelope, targetOrigin);
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
          ...(outcome.transitionId ? { transitionId: outcome.transitionId } : {})
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
    postSnapshot(machine.getSnapshot());
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

    const unregisterEnvelope: JourneyDevtoolsBridgeUnregisterEnvelope = {
      ...createBaseEnvelope("unregister")
    };
    post(unregisterEnvelope);
  };
};
