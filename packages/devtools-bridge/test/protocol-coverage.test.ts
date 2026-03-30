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

describe("protocol guard edge coverage", () => {
  const capabilities = {
    commands: ["goToNextStep", "getExecutionPaths"] as const,
    observe: true as const,
    executionPaths: true
  };

  it("rejects non-record command and envelope shapes", () => {
    expect(isJourneyDevtoolsCommand(null)).toBe(false);
    expect(isJourneyDevtoolsCommand({ type: 1 })).toBe(false);

    expect(isJourneyDevtoolsEnvelope(null)).toBe(false);
    expect(
      isJourneyDevtoolsEnvelope({
        channel: JOURNEY_DEVTOOLS_CHANNEL,
        version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
        source: JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
        kind: "snapshot",
        machineId: "m1",
        timestamp: "now"
      })
    ).toBe(false);
  });

  it("rejects malformed command variants", () => {
    expect(isJourneyDevtoolsCommand({ type: "send", event: null })).toBe(false);
    expect(isJourneyDevtoolsCommand({ type: "clearStepError", stepId: 123 })).toBe(false);
    expect(
      isJourneyDevtoolsCommand({
        type: "send",
        event: { type: "custom", payload: { bad: () => undefined } }
      })
    ).toBe(false);
    expect(isJourneyDevtoolsCommand({ type: "unknown" })).toBe(false);
  });

  it("rejects malformed bridge envelopes by kind", () => {
    const base = {
      channel: JOURNEY_DEVTOOLS_CHANNEL,
      version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
      source: JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
      machineId: "m1",
      timestamp: Date.now()
    };

    expect(
      isJourneyDevtoolsBridgeEnvelope({
        ...base,
        version: JOURNEY_DEVTOOLS_LEGACY_PROTOCOL_VERSION,
        kind: "register",
        meta: {
          machineId: "m1",
          label: "Flow",
          appName: "App"
        },
        snapshot: {}
      })
    ).toBe(true);
    expect(
      isJourneyDevtoolsBridgeEnvelope({
        ...base,
        kind: "register",
        meta: {
          machineId: "m1",
          label: "Flow",
          appName: "App"
        },
        snapshot: {}
      })
    ).toBe(false);
    expect(
      isJourneyDevtoolsBridgeEnvelope({
        ...base,
        kind: "register",
        meta: {
          machineId: "m1",
          label: "Flow",
          appName: "App",
          capabilities: {
            commands: [...capabilities.commands],
            observe: capabilities.observe,
            executionPaths: capabilities.executionPaths
          }
        },
        snapshot: {}
      })
    ).toBe(true);
    expect(isJourneyDevtoolsBridgeEnvelope({ ...base, kind: "register", snapshot: {} })).toBe(
      false
    );
    expect(
      isJourneyDevtoolsBridgeEnvelope({
        ...base,
        kind: "commandResult",
        requestId: "r1",
        snapshot: {},
        error: {
          name: "Error",
          message: "boom",
          stack: null,
          cause: null
        }
      })
    ).toBe(true);
    expect(
      isJourneyDevtoolsBridgeEnvelope({ ...base, kind: "commandResult", requestId: "r1" })
    ).toBe(false);
    expect(
      isJourneyDevtoolsBridgeEnvelope({ ...base, kind: "commandError", requestId: "r1", error: {} })
    ).toBe(true);
    expect(
      isJourneyDevtoolsBridgeEnvelope({ ...base, kind: "commandError", requestId: 1, error: {} })
    ).toBe(false);
    expect(isJourneyDevtoolsBridgeEnvelope({ ...base, kind: "unknown" })).toBe(false);
  });

  it("rejects bridge envelopes with non-JSON-safe payload values", () => {
    const base = {
      channel: JOURNEY_DEVTOOLS_CHANNEL,
      version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
      source: JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
      machineId: "m-json-safe",
      timestamp: Date.now()
    };

    expect(
      isJourneyDevtoolsBridgeEnvelope({
        ...base,
        kind: "snapshot",
        snapshot: {
          currentStepId: "start",
          context: {
            createdAt: new Date("2026-03-07T08:00:00.000Z"),
            count: 1n
          }
        }
      })
    ).toBe(false);
  });

  it("rejects extension envelopes with invalid kind or payload", () => {
    const base = {
      channel: JOURNEY_DEVTOOLS_CHANNEL,
      version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
      source: JOURNEY_DEVTOOLS_EXTENSION_SOURCE,
      machineId: "m1",
      timestamp: Date.now()
    };

    expect(
      isJourneyDevtoolsExtensionEnvelope({
        ...base,
        kind: "command",
        requestId: "r1",
        command: { type: "goToNextStep" }
      })
    ).toBe(true);

    expect(
      isJourneyDevtoolsExtensionEnvelope({
        ...base,
        kind: "snapshot",
        requestId: "r1",
        command: { type: "goToNextStep" }
      })
    ).toBe(false);

    expect(
      isJourneyDevtoolsExtensionEnvelope({
        ...base,
        kind: "command",
        requestId: "r1",
        command: { type: "send", event: null }
      })
    ).toBe(false);
  });
});
