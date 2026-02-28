import { describe, expect, it } from "vitest";

import {
  JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
  JOURNEY_DEVTOOLS_CHANNEL,
  JOURNEY_DEVTOOLS_EXTENSION_SOURCE,
  JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
  isJourneyDevtoolsBridgeEnvelope,
  isJourneyDevtoolsCommand,
  isJourneyDevtoolsEnvelope,
  isJourneyDevtoolsExtensionEnvelope
} from "@rxova/journey-devtools-bridge";

describe("protocol guards", () => {
  it("accepts valid commands", () => {
    expect(isJourneyDevtoolsCommand({ type: "goToNextStep" })).toBe(true);
    expect(isJourneyDevtoolsCommand({ type: "goToStepById", stepId: "review" })).toBe(true);
    expect(
      isJourneyDevtoolsCommand({
        type: "updateStepMetadata",
        stepId: "review",
        metadata: { title: "Review updated" }
      })
    ).toBe(true);
    expect(
      isJourneyDevtoolsCommand({ type: "send", event: { type: "retry", payload: { at: 1 } } })
    ).toBe(true);
  });

  it("rejects invalid commands", () => {
    expect(isJourneyDevtoolsCommand({ type: "goToStepById" })).toBe(false);
    expect(isJourneyDevtoolsCommand({ type: "updateStepMetadata", stepId: "", metadata: {} })).toBe(
      false
    );
    expect(isJourneyDevtoolsCommand({ type: "trimHistory", maxHistory: "10" })).toBe(false);
    expect(isJourneyDevtoolsCommand({ type: "send", event: { payload: "x" } })).toBe(false);
  });

  it("accepts valid envelopes and rejects malformed payloads", () => {
    const commandEnvelope = {
      channel: JOURNEY_DEVTOOLS_CHANNEL,
      version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
      source: JOURNEY_DEVTOOLS_EXTENSION_SOURCE,
      kind: "command",
      machineId: "machine-1",
      requestId: "req-1",
      command: { type: "goToNextStep" },
      timestamp: Date.now()
    };

    const bridgeEnvelope = {
      channel: JOURNEY_DEVTOOLS_CHANNEL,
      version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
      source: JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
      kind: "snapshot",
      machineId: "machine-1",
      snapshot: {
        currentStepId: "start"
      },
      timestamp: Date.now()
    };

    const malformedEnvelope = {
      channel: JOURNEY_DEVTOOLS_CHANNEL,
      version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
      source: JOURNEY_DEVTOOLS_EXTENSION_SOURCE,
      kind: "command",
      machineId: "machine-1",
      requestId: "req-1",
      command: { type: "goToStepById" },
      timestamp: Date.now()
    };

    expect(isJourneyDevtoolsExtensionEnvelope(commandEnvelope)).toBe(true);
    expect(isJourneyDevtoolsBridgeEnvelope(bridgeEnvelope)).toBe(true);
    expect(isJourneyDevtoolsEnvelope(commandEnvelope)).toBe(true);
    expect(isJourneyDevtoolsEnvelope(bridgeEnvelope)).toBe(true);
    expect(isJourneyDevtoolsEnvelope(malformedEnvelope)).toBe(false);
  });
});
