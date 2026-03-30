import { describe, expect, it } from "vitest";

import {
  JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
  JOURNEY_DEVTOOLS_CHANNEL,
  JOURNEY_DEVTOOLS_LEGACY_PROTOCOL_VERSION,
  JOURNEY_DEVTOOLS_PROTOCOL_VERSION
} from "@rxova/journey-devtools-bridge";
import {
  createCommandEnvelope,
  createTransportErrorEnvelope,
  isBackgroundToContentMessage,
  isBackgroundToPanelMessage,
  isContentToBackgroundMessage,
  isPanelToBackgroundMessage,
  serializeTransportError
} from "../src/shared";

describe("shared message guards", () => {
  it("accepts valid panel->background command messages", () => {
    const envelope = createCommandEnvelope("m1", "req-1", { type: "goToNextStep" });

    expect(
      isPanelToBackgroundMessage({
        type: "panel-command",
        tabId: 5,
        envelope
      })
    ).toBe(true);

    expect(isPanelToBackgroundMessage({ type: "panel-command", tabId: "5", envelope })).toBe(false);
    expect(isPanelToBackgroundMessage(null)).toBe(false);
    expect(isPanelToBackgroundMessage({ type: "unknown" })).toBe(false);
  });

  it("creates legacy-version command envelopes when requested", () => {
    const envelope = createCommandEnvelope(
      "m-legacy",
      "req-legacy",
      { type: "goToNextStep" },
      JOURNEY_DEVTOOLS_LEGACY_PROTOCOL_VERSION
    );

    expect(envelope.version).toBe(JOURNEY_DEVTOOLS_LEGACY_PROTOCOL_VERSION);
    expect(
      isPanelToBackgroundMessage({
        type: "panel-command",
        tabId: 5,
        envelope
      })
    ).toBe(true);
  });

  it("accepts valid content->background bridge envelopes and rejects malformed ones", () => {
    const valid = {
      type: "bridge-envelope",
      envelope: {
        channel: JOURNEY_DEVTOOLS_CHANNEL,
        version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
        source: JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
        kind: "snapshot",
        machineId: "m1",
        snapshot: { currentStepId: "start" },
        timestamp: Date.now()
      }
    };

    const invalid = {
      type: "bridge-envelope",
      envelope: {
        channel: JOURNEY_DEVTOOLS_CHANNEL,
        version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
        source: JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
        kind: "snapshot",
        machineId: "m1",
        timestamp: Date.now()
      }
    };

    expect(isContentToBackgroundMessage(valid)).toBe(true);
    expect(isContentToBackgroundMessage(invalid)).toBe(false);
    expect(isContentToBackgroundMessage({ type: "other" })).toBe(false);
    expect(isContentToBackgroundMessage(null)).toBe(false);
  });

  it("validates background->panel payload shape", () => {
    expect(isBackgroundToPanelMessage({ type: "panel-connected", connected: true })).toBe(true);
    expect(isBackgroundToPanelMessage({ type: "panel-connected", connected: "yes" })).toBe(false);
    expect(
      isBackgroundToPanelMessage({
        type: "panel-warning",
        warning: {
          code: "injection-failed",
          message: "warn",
          tabId: 1
        }
      })
    ).toBe(true);
    expect(isBackgroundToPanelMessage({ type: "panel-warning", warning: null })).toBe(true);
    expect(
      isBackgroundToPanelMessage({
        type: "panel-warning",
        warning: {
          code: "invalid-code",
          message: "warn",
          tabId: 1
        }
      })
    ).toBe(false);
    expect(isBackgroundToPanelMessage({ type: "panel-warning", warning: 42 })).toBe(false);

    expect(
      isBackgroundToPanelMessage({
        type: "panel-bridge-envelope",
        envelope: {
          channel: JOURNEY_DEVTOOLS_CHANNEL,
          version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
          source: JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
          kind: "snapshot",
          machineId: "m1",
          snapshot: { currentStepId: "start" },
          timestamp: Date.now()
        }
      })
    ).toBe(true);
    expect(isBackgroundToPanelMessage({ type: "panel-bridge-envelope", envelope: null })).toBe(
      false
    );
    expect(isBackgroundToPanelMessage({ type: "other" })).toBe(false);
    expect(isBackgroundToPanelMessage(null)).toBe(false);
  });

  it("validates background->content payload shape", () => {
    const extensionEnvelope = createCommandEnvelope("m1", "req-1", { type: "goToNextStep" });

    expect(
      isBackgroundToContentMessage({
        type: "extension-envelope",
        envelope: extensionEnvelope
      })
    ).toBe(true);
    expect(isBackgroundToContentMessage({ type: "bridge-replay-request" })).toBe(true);
    expect(
      isBackgroundToContentMessage({
        type: "extension-envelope",
        envelope: { kind: "invalid" }
      })
    ).toBe(false);
    expect(isBackgroundToContentMessage({ type: "unknown" })).toBe(false);
    expect(isBackgroundToContentMessage(null)).toBe(false);
  });

  it("serializes transport errors and wraps them in commandError envelopes", () => {
    const serializedError = serializeTransportError(new Error("boom"));
    expect(serializedError).toEqual({
      name: "Error",
      message: "boom",
      stack: expect.any(String),
      cause: null
    });

    expect(serializeTransportError("bad request")).toEqual({
      name: null,
      message: "bad request",
      stack: null,
      cause: null
    });

    expect(serializeTransportError({ unknown: true })).toEqual({
      name: null,
      message: "Unknown transport error",
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

    expect(
      serializeTransportError({
        name: "NullableCauseError",
        message: "nullable",
        stack: "trace",
        cause: undefined
      })
    ).toEqual({
      name: "NullableCauseError",
      message: "nullable",
      stack: "trace",
      cause: null
    });

    expect(
      serializeTransportError({
        name: "RuntimeError",
        message: "Could not establish connection. Receiving end does not exist.",
        stack: "stacktrace"
      })
    ).toEqual({
      name: "RuntimeError",
      message: "Could not establish connection. Receiving end does not exist.",
      stack: "stacktrace",
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

    expect(serializeTransportError(404)).toEqual({
      name: null,
      message: "Unknown transport error",
      stack: null,
      cause: null
    });

    const errorEnvelope = createTransportErrorEnvelope("m1", "req-1", serializedError);
    expect(errorEnvelope).toMatchObject({
      channel: JOURNEY_DEVTOOLS_CHANNEL,
      version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
      source: JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
      kind: "commandError",
      machineId: "m1",
      requestId: "req-1",
      error: serializedError
    });
    expect(typeof errorEnvelope.timestamp).toBe("number");
  });
});
