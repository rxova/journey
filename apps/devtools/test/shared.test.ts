import { describe, expect, it } from "vitest";

import {
  JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
  JOURNEY_DEVTOOLS_CHANNEL,
  JOURNEY_DEVTOOLS_LEGACY_PROTOCOL_VERSION,
  JOURNEY_DEVTOOLS_PROTOCOL_VERSION
} from "@rxova/journey-devtools-bridge";
import {
  createInvokeEnvelope,
  createTransportErrorEnvelope,
  isBackgroundToContentMessage,
  isBackgroundToPanelMessage,
  isContentToBackgroundMessage,
  isPanelToBackgroundMessage,
  serializeTransportError
} from "../src/shared";

describe("shared transport helpers", () => {
  it("accepts valid panel messages and rejects malformed ones", () => {
    const envelope = createInvokeEnvelope("m1", "req-1", { operationId: "core.goToNextStep" });

    expect(
      isPanelToBackgroundMessage({
        type: "panel-init",
        tabId: 7
      })
    ).toBe(true);
    expect(
      isPanelToBackgroundMessage({
        type: "panel-command",
        tabId: 7,
        envelope
      })
    ).toBe(true);
    expect(
      isPanelToBackgroundMessage({
        type: "panel-command",
        tabId: "7",
        envelope
      })
    ).toBe(false);
    expect(
      isPanelToBackgroundMessage({
        type: "panel-command",
        tabId: 7,
        envelope: { kind: "invalid" }
      })
    ).toBe(false);
    expect(isPanelToBackgroundMessage(null)).toBe(false);
  });

  it("creates invoke envelopes for current and legacy protocol versions", () => {
    const current = createInvokeEnvelope("m1", "req-1", {
      operationId: "core.goToNextStep",
      input: { count: 1 }
    });
    const legacy = createInvokeEnvelope(
      "m1",
      "req-2",
      { operationId: "core.goToNextStep" },
      JOURNEY_DEVTOOLS_LEGACY_PROTOCOL_VERSION
    );

    expect(current).toMatchObject({
      channel: JOURNEY_DEVTOOLS_CHANNEL,
      version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
      source: "rxova-journey-extension",
      kind: "invoke",
      machineId: "m1",
      requestId: "req-1",
      invocation: {
        operationId: "core.goToNextStep",
        input: { count: 1 }
      }
    });
    expect(legacy.version).toBe(JOURNEY_DEVTOOLS_LEGACY_PROTOCOL_VERSION);
  });

  it("validates content and background transport messages", () => {
    const bridgeEnvelope = {
      channel: JOURNEY_DEVTOOLS_CHANNEL,
      version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
      source: JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
      kind: "snapshot",
      machineId: "m1",
      snapshot: { currentStepId: "start" },
      timestamp: Date.now()
    } as const;

    expect(
      isContentToBackgroundMessage({
        type: "bridge-envelope",
        envelope: bridgeEnvelope
      })
    ).toBe(true);
    expect(
      isContentToBackgroundMessage({
        type: "bridge-envelope",
        envelope: { ...bridgeEnvelope, snapshot: undefined }
      })
    ).toBe(false);

    expect(
      isBackgroundToContentMessage({
        type: "bridge-replay-request"
      })
    ).toBe(true);
    expect(
      isBackgroundToContentMessage({
        type: "extension-envelope",
        envelope: createInvokeEnvelope("m1", "req-1", { operationId: "core.goToNextStep" })
      })
    ).toBe(true);
    expect(
      isBackgroundToContentMessage({
        type: "extension-envelope",
        envelope: { kind: "bad" }
      })
    ).toBe(false);

    expect(
      isBackgroundToPanelMessage({
        type: "panel-connected",
        connected: true
      })
    ).toBe(true);
    expect(
      isBackgroundToPanelMessage({
        type: "panel-warning",
        warning: {
          code: "injection-failed",
          message: "warn",
          recoverable: true,
          tabId: 1
        }
      })
    ).toBe(true);
    expect(
      isBackgroundToPanelMessage({
        type: "panel-bridge-envelope",
        envelope: bridgeEnvelope
      })
    ).toBe(true);
    expect(
      isBackgroundToPanelMessage({
        type: "panel-warning",
        warning: {
          code: "not-real",
          message: "warn",
          tabId: 1
        }
      })
    ).toBe(false);
    expect(isBackgroundToPanelMessage({ type: "unknown" })).toBe(false);
    expect(isBackgroundToContentMessage(null)).toBe(false);
    expect(isBackgroundToContentMessage({ type: "extension-envelope", envelope: null })).toBe(
      false
    );
    expect(isPanelToBackgroundMessage({ type: "panel-init", tabId: "7" })).toBe(false);
    expect(isPanelToBackgroundMessage({ type: "unknown", tabId: 7 })).toBe(false);
    expect(isBackgroundToPanelMessage(null)).toBe(false);
    expect(
      isBackgroundToPanelMessage({
        type: "panel-warning",
        warning: "warn"
      })
    ).toBe(false);
    expect(
      isBackgroundToPanelMessage({
        type: "panel-warning",
        warning: {
          code: "injection-failed",
          message: "warn",
          recoverable: "yes",
          tabId: 1
        }
      })
    ).toBe(false);
  });

  it("serializes transport errors across supported shapes", () => {
    expect(serializeTransportError(new Error("boom"))).toEqual({
      name: "Error",
      message: "boom",
      stack: expect.any(String),
      cause: null
    });

    const stackless = new Error("stackless");
    Object.defineProperty(stackless, "stack", { value: 42 });
    expect(serializeTransportError(stackless)).toEqual({
      name: "Error",
      message: "stackless",
      stack: null,
      cause: null
    });

    expect(
      serializeTransportError({
        name: "WrappedError",
        message: "wrapped",
        stack: "trace",
        cause: { code: "E_WRAPPED" }
      })
    ).toEqual({
      name: "WrappedError",
      message: "wrapped",
      stack: "trace",
      cause: { code: "E_WRAPPED" }
    });

    expect(serializeTransportError("bad request")).toEqual({
      name: null,
      message: "bad request",
      stack: null,
      cause: null
    });
    expect(serializeTransportError(404)).toEqual({
      name: null,
      message: "Unknown transport error",
      stack: null,
      cause: null
    });
    expect(serializeTransportError({ message: 42, name: 7, stack: false })).toEqual({
      name: null,
      message: "Unknown transport error",
      stack: null,
      cause: null
    });
    expect(serializeTransportError({ cause: undefined })).toEqual({
      name: null,
      message: "Unknown transport error",
      stack: null,
      cause: null
    });
  });

  it("wraps serialized transport errors as operationError envelopes", () => {
    const serialized = serializeTransportError(new Error("port closed"));
    const envelope = createTransportErrorEnvelope("m1", "req-1", serialized);

    expect(envelope).toMatchObject({
      channel: JOURNEY_DEVTOOLS_CHANNEL,
      version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
      source: JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
      kind: "operationError",
      machineId: "m1",
      requestId: "req-1",
      operationId: "transport",
      error: serialized
    });
    expect(typeof envelope.timestamp).toBe("number");
  });
});
