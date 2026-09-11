import { resolveNonProductionEnvironment, warnInDevelopment } from "@rxova/journey-common/dev";
import { isExpectedWindowOrigin, resolveWindowTargetOrigin } from "@rxova/journey-common/origin";
import { isRecord } from "@rxova/journey-common/predicates";
import { cloneForTransport, serializeError } from "@rxova/journey-common/serialization";
import {
  buildOperationRunners,
  createJourneyMachineId,
  OperationRateLimiter,
  serializeSnapshot
} from "./bridge.helpers";
import {
  JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
  JOURNEY_DEVTOOLS_CHANNEL,
  JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
  JOURNEY_DEVTOOLS_REPLAY_REQUEST,
  isCompatibleInvokeProtocolVersion,
  isJourneyDevtoolsExtensionEnvelope
} from "./protocol";
import type {
  JourneyDevtoolsAttachableMachine,
  JourneyDevtoolsBridgeOptions,
  LooseMachine,
  OperationRunner
} from "./bridge.types";
import type {
  JourneyDevtoolsBridgeEnvelope,
  JourneyDevtoolsMachineMeta,
  JourneyDevtoolsOperationResultPayload
} from "./protocol.types";
import type { JourneySnapshot, JourneySubscriptionEvent } from "@rxova/journey-core";

const OBSERVED_EVENTS: readonly JourneySubscriptionEvent[] = [
  "stepEnter",
  "stepLeave",
  "statusChange",
  "contextChange",
  "navigationBlocked",
  "error"
];

const isReplayRequestMessage = (value: unknown): value is { type: string } =>
  isRecord(value) && value.type === JOURNEY_DEVTOOLS_REPLAY_REQUEST;

/**
 * Attaches a journey machine to the devtools extension over
 * `window.postMessage`: registers the machine, streams snapshots and
 * observations, and answers operation invokes (gated by `mutationsEnabled`).
 * Returns a detach function; both attach and detach are safe no-ops outside
 * the browser or when the bridge is disabled.
 */
export function attachJourneyDevtools(
  machine: JourneyDevtoolsAttachableMachine,
  options: JourneyDevtoolsBridgeOptions = {}
): () => void {
  const enabled = options.enabled ?? resolveNonProductionEnvironment({});
  if (!enabled || typeof window === "undefined") {
    return () => undefined;
  }

  const target = machine as unknown as LooseMachine;
  const machineId = options.machineId ?? createJourneyMachineId();
  const mutationsEnabled = options.mutationsEnabled ?? true;
  const rateLimiter = new OperationRateLimiter(
    options.rateLimit?.maxPerWindow,
    options.rateLimit?.windowMs
  );
  const runners = new Map<string, OperationRunner>(
    buildOperationRunners(machine).map((runner) => [runner.descriptor.id, runner])
  );
  const targetOrigin = resolveWindowTargetOrigin();
  let detached = false;

  const post = (envelope: JourneyDevtoolsBridgeEnvelope): void => {
    window.postMessage(envelope, targetOrigin);
  };

  const base = () => ({
    channel: JOURNEY_DEVTOOLS_CHANNEL,
    version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
    source: JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
    machineId,
    timestamp: Date.now()
  });

  const buildMeta = (): JourneyDevtoolsMachineMeta => {
    const snapshot = target.getSnapshot() as JourneySnapshot;
    return {
      machineId,
      label: options.label ?? "Journey Machine",
      appName: options.appName ?? (typeof document === "undefined" ? null : document.title || null),
      mutationsEnabled,
      mode: snapshot.type,
      stepIds: Object.keys(snapshot.history.visited),
      ...(options.eventTypes ? { eventTypes: options.eventTypes } : {}),
      features: groupFeatures([...runners.values()])
    };
  };

  const postRegister = (): void => {
    post({
      ...base(),
      kind: "register",
      meta: buildMeta(),
      snapshot: serializeSnapshot(target.getSnapshot())
    });
  };

  const postOperationError = (requestId: string, operationId: string, error: unknown): void => {
    post({
      ...base(),
      kind: "operationError",
      requestId,
      operationId,
      error: serializeError(error)
    });
  };

  const runInvoke = async (
    requestId: string,
    operationId: string,
    input?: Record<string, unknown>
  ) => {
    const runner = runners.get(operationId);
    if (!runner) {
      postOperationError(requestId, operationId, new Error(`unknown operation "${operationId}"`));
      return;
    }
    if (runner.descriptor.mutates && !mutationsEnabled) {
      postOperationError(
        requestId,
        operationId,
        new Error("mutations are disabled for this machine")
      );
      return;
    }
    if (!rateLimiter.isAllowed()) {
      postOperationError(requestId, operationId, new Error("operation rate limit exceeded"));
      return;
    }
    let result: JourneyDevtoolsOperationResultPayload;
    try {
      result = await runner.run(input);
    } catch (error) {
      postOperationError(requestId, operationId, error);
      return;
    }
    post({ ...base(), kind: "operationResult", requestId, operationId, result });
  };

  const onMessage = (event: MessageEvent): void => {
    if (detached || !isExpectedWindowOrigin(event.origin)) {
      return;
    }
    if (isReplayRequestMessage(event.data)) {
      postRegister();
      return;
    }
    if (!isJourneyDevtoolsExtensionEnvelope(event.data)) {
      return;
    }
    const envelope = event.data;
    if (envelope.machineId !== machineId) {
      return;
    }
    if (!isCompatibleInvokeProtocolVersion(envelope.version)) {
      warnInDevelopment(
        `journey devtools: ignoring invoke from incompatible protocol version ${envelope.version}`
      );
      return;
    }
    void runInvoke(envelope.requestId, envelope.invocation.operationId, envelope.invocation.input);
  };

  const unsubscribes: (() => void)[] = [
    target.subscriptions.subscribeSelector(
      (snapshot) => snapshot,
      (snapshot) => {
        post({ ...base(), kind: "snapshot", snapshot: serializeSnapshot(snapshot) });
      }
    ),
    ...OBSERVED_EVENTS.map((type) =>
      target.subscriptions.subscribeEvent(type, (payload) => {
        // observation envelopes stay lean: the snapshot streams separately
        const event: Record<string, unknown> = { type, ...payload };
        delete event.snapshot;
        post({
          ...base(),
          kind: "observation",
          event: cloneForTransport(event) as Record<string, unknown>
        });
      })
    )
  ];

  window.addEventListener("message", onMessage);
  postRegister();

  return () => {
    if (detached) {
      return;
    }
    detached = true;
    for (const unsubscribe of unsubscribes.splice(0)) {
      unsubscribe();
    }
    window.removeEventListener("message", onMessage);
    post({ ...base(), kind: "unregister" });
  };
}

/** Groups flat operation runners into wire feature descriptors by id prefix. */
function groupFeatures(
  runners: readonly OperationRunner[]
): JourneyDevtoolsMachineMeta["features"] {
  const groups = new Map<string, OperationRunner[]>();
  for (const runner of runners) {
    const featureId = runner.descriptor.id.split(".")[0] as string;
    const bucket = groups.get(featureId) ?? [];
    bucket.push(runner);
    groups.set(featureId, bucket);
  }
  return [...groups.entries()].map(([id, bucket]) => ({
    id,
    label: id,
    description: null,
    operations: bucket.map((runner) => runner.descriptor)
  }));
}
