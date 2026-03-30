import { describe, expect, it } from "vitest";

import {
  JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
  JOURNEY_DEVTOOLS_CHANNEL,
  JOURNEY_DEVTOOLS_EXTENSION_SOURCE,
  JOURNEY_DEVTOOLS_LEGACY_PROTOCOL_VERSION,
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
    expect(isJourneyDevtoolsCommand({ type: "clearStepError", stepId: "review" })).toBe(true);
    expect(
      isJourneyDevtoolsCommand({
        type: "getExecutionPaths",
        options: { maxDepth: 3, maxPaths: 10 }
      })
    ).toBe(true);
    expect(
      isJourneyDevtoolsCommand({ type: "send", event: { type: "retry", payload: { at: 1 } } })
    ).toBe(true);
  });

  it("rejects invalid commands", () => {
    expect(isJourneyDevtoolsCommand({ type: "goToStepById" })).toBe(false);
    expect(isJourneyDevtoolsCommand({ type: "clearStepError", stepId: 123 })).toBe(false);
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
      kind: "register",
      machineId: "machine-1",
      meta: {
        machineId: "machine-1",
        label: "Checkout",
        appName: "Store",
        capabilities: {
          commands: ["goToNextStep", "getExecutionPaths"],
          observe: true,
          executionPaths: true
        }
      },
      snapshot: {
        currentStepId: "start"
      },
      timestamp: Date.now()
    };

    const observationEnvelope = {
      channel: JOURNEY_DEVTOOLS_CHANNEL,
      version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
      source: JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
      kind: "observation",
      machineId: "machine-1",
      event: {
        type: "journey.start",
        stepId: "start",
        timestamp: Date.now()
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
    expect(isJourneyDevtoolsBridgeEnvelope(observationEnvelope)).toBe(true);
    expect(isJourneyDevtoolsEnvelope(commandEnvelope)).toBe(true);
    expect(isJourneyDevtoolsEnvelope(bridgeEnvelope)).toBe(true);
    expect(isJourneyDevtoolsEnvelope(observationEnvelope)).toBe(true);
    expect(isJourneyDevtoolsEnvelope(malformedEnvelope)).toBe(false);
  });

  it("accepts legacy v3 register envelopes without capabilities metadata", () => {
    const legacyRegisterEnvelope = {
      channel: JOURNEY_DEVTOOLS_CHANNEL,
      version: JOURNEY_DEVTOOLS_LEGACY_PROTOCOL_VERSION,
      source: JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
      kind: "register",
      machineId: "machine-legacy",
      meta: {
        machineId: "machine-legacy",
        label: "Checkout",
        appName: "Store",
        commandsEnabled: true
      },
      snapshot: {
        currentStepId: "start"
      },
      timestamp: Date.now()
    };

    expect(isJourneyDevtoolsBridgeEnvelope(legacyRegisterEnvelope)).toBe(true);
    expect(isJourneyDevtoolsEnvelope(legacyRegisterEnvelope)).toBe(true);
  });
});
