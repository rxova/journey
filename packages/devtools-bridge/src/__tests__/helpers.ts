import { createGraphJourney, createLinearJourney } from "@rxova/journey-core";
import {
  JOURNEY_DEVTOOLS_CHANNEL,
  JOURNEY_DEVTOOLS_EXTENSION_SOURCE,
  JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
  isJourneyDevtoolsBridgeEnvelope,
  type JourneyDevtoolsBridgeEnvelope,
  type JourneyDevtoolsExtensionInvokeEnvelope,
  type JourneyDevtoolsProtocolVersion
} from "@rxova/journey-devtools-bridge";

/** Waits for queued message events and pending machine effects to settle. */
export const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

export async function startedLinearMachine() {
  const machine = createLinearJourney({ steps: ["a", "b", "c"], context: { n: 0 } });
  machine.controls.start();
  await flush();
  return machine;
}

export async function startedGraphMachine() {
  const machine = createGraphJourney({
    steps: { a: {}, b: {} },
    transitions: { GO: { from: "a", to: "b" } },
    initial: "a",
    context: { n: 0 }
  });
  machine.controls.start();
  await flush();
  return machine;
}

/** Captures every bridge envelope posted to the window until stopped. */
export function captureBridgeEnvelopes() {
  const envelopes: JourneyDevtoolsBridgeEnvelope[] = [];
  const onMessage = (event: MessageEvent) => {
    if (isJourneyDevtoolsBridgeEnvelope(event.data)) {
      envelopes.push(event.data);
    }
  };
  window.addEventListener("message", onMessage);
  return {
    envelopes,
    ofKind: <TKind extends JourneyDevtoolsBridgeEnvelope["kind"]>(kind: TKind) =>
      envelopes.filter(
        (envelope): envelope is Extract<JourneyDevtoolsBridgeEnvelope, { kind: TKind }> =>
          envelope.kind === kind
      ),
    clear: () => {
      envelopes.length = 0;
    },
    stop: () => window.removeEventListener("message", onMessage)
  };
}

export function buildInvokeEnvelope(
  machineId: string,
  operationId: string,
  input?: Record<string, unknown>,
  overrides: { requestId?: string; version?: JourneyDevtoolsProtocolVersion } = {}
): JourneyDevtoolsExtensionInvokeEnvelope {
  return {
    channel: JOURNEY_DEVTOOLS_CHANNEL,
    version: overrides.version ?? JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
    source: JOURNEY_DEVTOOLS_EXTENSION_SOURCE,
    kind: "invoke",
    machineId,
    timestamp: Date.now(),
    requestId: overrides.requestId ?? `req-${Math.random().toString(36).slice(2, 8)}`,
    invocation: { operationId, ...(input === undefined ? {} : { input }) }
  };
}

/**
 * Delivers a message to the bridge and waits for it to be processed. Uses a
 * manual MessageEvent because jsdom's `postMessage` delivers with an empty
 * `origin`, which the bridge's origin check rightly rejects.
 */
export async function postToBridge(data: unknown): Promise<void> {
  window.dispatchEvent(new MessageEvent("message", { data, origin: window.location.origin }));
  await flush();
  await flush();
}
