import { describe, expect, it } from "vitest";

import {
  JOURNEY_DEVTOOLS_CHANNEL,
  JOURNEY_DEVTOOLS_EXTENSION_SOURCE,
  JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
  isJourneyDevtoolsCommand,
  isJourneyDevtoolsExtensionEnvelope
} from "@rxova/journey-devtools-bridge";

describe("security: deep payload validation", () => {
  it("rejects deeply nested payloads beyond MAX_PAYLOAD_DEPTH", () => {
    // Create a deeply nested object (15 levels deep, exceeding MAX_PAYLOAD_DEPTH of 10)
    let deepPayload: Record<string, unknown> = { value: "leaf" };
    for (let i = 0; i < 15; i++) {
      deepPayload = { nested: deepPayload };
    }

    const command = {
      type: "send",
      event: {
        type: "update",
        payload: deepPayload
      }
    };

    expect(isJourneyDevtoolsCommand(command)).toBe(false);
  });

  it("accepts reasonably nested payloads within MAX_PAYLOAD_DEPTH", () => {
    // Create a moderately nested object (5 levels deep, within limit)
    let safePayload: Record<string, unknown> = { value: "leaf" };
    for (let i = 0; i < 5; i++) {
      safePayload = { nested: safePayload };
    }

    const command = {
      type: "send",
      event: {
        type: "update",
        payload: safePayload
      }
    };

    expect(isJourneyDevtoolsCommand(command)).toBe(true);
  });

  it("rejects payloads with non-plain object prototypes (prototype pollution defense)", () => {
    class CustomClass {
      value = "malicious";
    }

    const command = {
      type: "send",
      event: {
        type: "update",
        payload: new CustomClass()
      }
    };

    expect(isJourneyDevtoolsCommand(command)).toBe(false);
  });

  it("rejects extremely large payloads exceeding MAX_PAYLOAD_SIZE", () => {
    // Create a large string that exceeds 500KB
    const largeString = "x".repeat(600_000);

    const command = {
      type: "send",
      event: {
        type: "update",
        payload: { data: largeString }
      }
    };

    expect(isJourneyDevtoolsCommand(command)).toBe(false);
  });

  it("accepts normal-sized payloads", () => {
    const normalPayload = {
      type: "update",
      data: { items: Array.from({ length: 100 }, (_, i) => ({ id: i, name: `Item ${i}` })) }
    };

    const command = {
      type: "send",
      event: normalPayload
    };

    expect(isJourneyDevtoolsCommand(command)).toBe(true);
  });

  it("rejects payloads with circular references", () => {
    const circularObject: Record<string, unknown> = { a: 1 };
    circularObject.self = circularObject;

    const command = {
      type: "send",
      event: {
        type: "update",
        payload: circularObject
      }
    };

    expect(isJourneyDevtoolsCommand(command)).toBe(false);
  });

  it("rejects commands with function payloads", () => {
    const command = {
      type: "send",
      event: {
        type: "update",
        payload: { fn: () => "malicious" }
      }
    };

    expect(isJourneyDevtoolsCommand(command)).toBe(false);
  });

  it("rejects commands with symbol payloads", () => {
    const command = {
      type: "send",
      event: {
        type: "update",
        payload: { sym: Symbol("test") }
      }
    };

    expect(isJourneyDevtoolsCommand(command)).toBe(false);
  });
});

describe("security: command validation constraints", () => {
  it("rejects commands with excessively long type strings", () => {
    const longType = "a".repeat(51); // Exceeds MAX of 50
    expect(isJourneyDevtoolsCommand({ type: longType })).toBe(false);
  });

  it("rejects commands with empty type strings", () => {
    expect(isJourneyDevtoolsCommand({ type: "" })).toBe(false);
  });

  it("rejects goTo commands with excessively long destination strings", () => {
    const longDestination = "a".repeat(101); // Exceeds MAX of 100
    expect(isJourneyDevtoolsCommand({ type: "goTo", to: longDestination })).toBe(false);
  });

  it("rejects goTo commands with empty destination", () => {
    expect(isJourneyDevtoolsCommand({ type: "goTo", to: "" })).toBe(false);
  });

  it("rejects clearStepError with excessively long stepId", () => {
    const longStepId = "a".repeat(101); // Exceeds MAX of 100
    expect(isJourneyDevtoolsCommand({ type: "clearStepError", stepId: longStepId })).toBe(false);
  });

  it("rejects trimHistory with negative maxHistory", () => {
    expect(isJourneyDevtoolsCommand({ type: "trimHistory", maxHistory: -1 })).toBe(false);
  });

  it("rejects trimHistory with excessively large maxHistory", () => {
    expect(isJourneyDevtoolsCommand({ type: "trimHistory", maxHistory: 10001 })).toBe(false);
  });

  it("rejects trimHistory with non-integer maxHistory", () => {
    expect(isJourneyDevtoolsCommand({ type: "trimHistory", maxHistory: 3.5 })).toBe(false);
  });

  it("rejects commands with extra unexpected properties", () => {
    expect(isJourneyDevtoolsCommand({ type: "next", extraProp: "bad" })).toBe(false);
  });

  it("rejects send commands with empty event type", () => {
    expect(isJourneyDevtoolsCommand({ type: "send", event: { type: "", payload: {} } })).toBe(
      false
    );
  });

  it("rejects send commands with excessively long event type", () => {
    const longEventType = "a".repeat(101);
    expect(
      isJourneyDevtoolsCommand({ type: "send", event: { type: longEventType, payload: {} } })
    ).toBe(false);
  });
});

describe("security: envelope validation", () => {
  it("rejects envelopes with excessively long requestId", () => {
    const longRequestId = "a".repeat(101); // Exceeds MAX of 100

    const envelope = {
      channel: JOURNEY_DEVTOOLS_CHANNEL,
      version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
      source: JOURNEY_DEVTOOLS_EXTENSION_SOURCE,
      kind: "command",
      machineId: "machine-1",
      requestId: longRequestId,
      command: { type: "next" },
      timestamp: Date.now()
    };

    expect(isJourneyDevtoolsExtensionEnvelope(envelope)).toBe(false);
  });

  it("rejects envelopes with empty requestId", () => {
    const envelope = {
      channel: JOURNEY_DEVTOOLS_CHANNEL,
      version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
      source: JOURNEY_DEVTOOLS_EXTENSION_SOURCE,
      kind: "command",
      machineId: "machine-1",
      requestId: "",
      command: { type: "next" },
      timestamp: Date.now()
    };

    expect(isJourneyDevtoolsExtensionEnvelope(envelope)).toBe(false);
  });

  it("accepts valid envelope with deeply nested but safe snapshot payload", () => {
    const safeSnapshot = {
      current: "step1",
      context: {
        user: { profile: { name: "Test", settings: { theme: "dark" } } },
        data: [1, 2, 3]
      }
    };

    const envelope = {
      channel: JOURNEY_DEVTOOLS_CHANNEL,
      version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
      source: JOURNEY_DEVTOOLS_EXTENSION_SOURCE,
      kind: "command",
      machineId: "machine-1",
      requestId: "req-1",
      command: { type: "send", event: { type: "update", payload: safeSnapshot } },
      timestamp: Date.now()
    };

    expect(isJourneyDevtoolsExtensionEnvelope(envelope)).toBe(true);
  });
});
