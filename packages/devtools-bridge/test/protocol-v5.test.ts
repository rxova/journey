import { describe, expect, it } from "vitest";

import {
  JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
  JOURNEY_DEVTOOLS_CHANNEL,
  JOURNEY_DEVTOOLS_EXTENSION_SOURCE,
  JOURNEY_DEVTOOLS_LEGACY_PROTOCOL_VERSION,
  JOURNEY_DEVTOOLS_PRIOR_PROTOCOL_VERSION,
  JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
  isCompatibleInvokeProtocolVersion,
  isJourneyDevtoolsBridgeEnvelope,
  isJourneyDevtoolsEnvelope,
  isJourneyDevtoolsExtensionEnvelope
} from "@rxova/journey-devtools-bridge";

import { createRegisterEnvelope } from "./helpers";

describe("protocol v5 guards", () => {
  it("accepts valid invoke and register envelopes", () => {
    const invokeEnvelope = {
      channel: JOURNEY_DEVTOOLS_CHANNEL,
      version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
      source: JOURNEY_DEVTOOLS_EXTENSION_SOURCE,
      kind: "invoke",
      machineId: "machine-1",
      requestId: "req-1",
      invocation: { operationId: "core.goToNextStep" },
      timestamp: Date.now()
    };

    const registerEnvelope = createRegisterEnvelope();

    expect(isJourneyDevtoolsExtensionEnvelope(invokeEnvelope)).toBe(true);
    expect(isJourneyDevtoolsBridgeEnvelope(registerEnvelope)).toBe(true);
    expect(isJourneyDevtoolsEnvelope(invokeEnvelope)).toBe(true);
    expect(isJourneyDevtoolsEnvelope(registerEnvelope)).toBe(true);
  });

  it("rejects malformed generic envelopes", () => {
    expect(isJourneyDevtoolsEnvelope(null)).toBe(false);
    expect(
      isJourneyDevtoolsEnvelope({
        channel: "__BAD__",
        version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
        source: JOURNEY_DEVTOOLS_EXTENSION_SOURCE,
        kind: "invoke",
        machineId: "machine-1",
        requestId: "req-1",
        invocation: { operationId: "core.goToNextStep" },
        timestamp: Date.now()
      })
    ).toBe(false);
    expect(
      isJourneyDevtoolsEnvelope({
        channel: JOURNEY_DEVTOOLS_CHANNEL,
        version: 999,
        source: JOURNEY_DEVTOOLS_EXTENSION_SOURCE,
        kind: "invoke",
        machineId: "machine-1",
        requestId: "req-1",
        invocation: { operationId: "core.goToNextStep" },
        timestamp: Date.now()
      })
    ).toBe(false);
    expect(
      isJourneyDevtoolsEnvelope({
        channel: JOURNEY_DEVTOOLS_CHANNEL,
        version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
        source: "malicious",
        kind: "invoke",
        machineId: "machine-1",
        requestId: "req-1",
        invocation: { operationId: "core.goToNextStep" },
        timestamp: Date.now()
      })
    ).toBe(false);
    expect(
      isJourneyDevtoolsEnvelope({
        channel: JOURNEY_DEVTOOLS_CHANNEL,
        version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
        source: JOURNEY_DEVTOOLS_EXTENSION_SOURCE,
        kind: "invoke",
        machineId: "machine-1",
        requestId: "req-1",
        invocation: { operationId: "core.goToNextStep" },
        timestamp: "now"
      })
    ).toBe(false);

    expect(
      isJourneyDevtoolsExtensionEnvelope({
        channel: JOURNEY_DEVTOOLS_CHANNEL,
        version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
        source: JOURNEY_DEVTOOLS_EXTENSION_SOURCE,
        kind: "invoke",
        machineId: "machine-1",
        requestId: "req-1",
        invocation: { input: { bad: true } },
        timestamp: Date.now()
      })
    ).toBe(false);

    expect(
      isJourneyDevtoolsBridgeEnvelope({
        channel: JOURNEY_DEVTOOLS_CHANNEL,
        version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
        source: JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
        kind: "register",
        machineId: "machine-1",
        timestamp: Date.now(),
        meta: {
          machineId: "machine-1",
          label: "Checkout",
          appName: "Store",
          mutationsEnabled: true,
          features: [
            {
              id: "core",
              label: "Core",
              description: null,
              operations: [
                {
                  id: "core.goToNextStep",
                  label: "goToNextStep",
                  description: null,
                  mutates: true,
                  output: "snapshot",
                  fields: "nope"
                }
              ]
            }
          ]
        },
        snapshot: {}
      })
    ).toBe(false);

    expect(
      isJourneyDevtoolsBridgeEnvelope({
        channel: JOURNEY_DEVTOOLS_CHANNEL,
        version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
        source: JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
        kind: "operationResult",
        machineId: "machine-1",
        requestId: "req-snapshot-error",
        operationId: "core.goToNextStep",
        result: {
          kind: "snapshot",
          snapshot: {},
          error: "bad"
        },
        timestamp: Date.now()
      })
    ).toBe(false);

    expect(
      isJourneyDevtoolsBridgeEnvelope({
        channel: JOURNEY_DEVTOOLS_CHANNEL,
        version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
        source: JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
        kind: "register",
        machineId: "machine-1",
        timestamp: Date.now(),
        meta: {
          machineId: "machine-1",
          label: "Checkout",
          appName: "Store",
          mutationsEnabled: true,
          features: [],
          eventTypesBySource: { start: [1] }
        },
        snapshot: {}
      })
    ).toBe(false);
  });

  it("accepts valid register variants and bridge event envelopes", () => {
    expect(
      isJourneyDevtoolsBridgeEnvelope({
        channel: JOURNEY_DEVTOOLS_CHANNEL,
        version: JOURNEY_DEVTOOLS_LEGACY_PROTOCOL_VERSION,
        source: JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
        kind: "register",
        machineId: "legacy-machine",
        timestamp: Date.now(),
        meta: {
          machineId: "legacy-machine",
          label: "Legacy",
          appName: "Old App",
          features: []
        },
        snapshot: {}
      })
    ).toBe(true);

    expect(
      isJourneyDevtoolsBridgeEnvelope({
        channel: JOURNEY_DEVTOOLS_CHANNEL,
        version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
        source: JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
        kind: "snapshot",
        machineId: "machine-1",
        timestamp: Date.now(),
        snapshot: { currentStepId: "start" }
      })
    ).toBe(true);

    expect(
      isJourneyDevtoolsBridgeEnvelope({
        channel: JOURNEY_DEVTOOLS_CHANNEL,
        version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
        source: JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
        kind: "observation",
        machineId: "machine-1",
        timestamp: Date.now(),
        event: { type: "journey.start", timestamp: 1 }
      })
    ).toBe(true);

    expect(
      isJourneyDevtoolsBridgeEnvelope({
        channel: JOURNEY_DEVTOOLS_CHANNEL,
        version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
        source: JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
        kind: "unregister",
        machineId: "machine-1",
        timestamp: Date.now()
      })
    ).toBe(true);
  });

  it("accepts valid result and error envelopes", () => {
    const resultEnvelope = {
      channel: JOURNEY_DEVTOOLS_CHANNEL,
      version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
      source: JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
      kind: "operationResult",
      machineId: "machine-1",
      requestId: "req-1",
      operationId: "core.goToNextStep",
      result: {
        kind: "snapshot",
        snapshot: {
          currentStepId: "start",
          history: { timeline: ["start"], index: 0 },
          context: { count: 0 },
          visited: { start: true },
          status: "running",
          async: { isLoading: false, byStep: {} }
        },
        transitioned: true,
        transitionId: "goToNextStep"
      },
      timestamp: Date.now()
    };
    const errorEnvelope = {
      channel: JOURNEY_DEVTOOLS_CHANNEL,
      version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
      source: JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
      kind: "operationError",
      machineId: "machine-1",
      requestId: "req-2",
      operationId: "core.goToNextStep",
      error: {
        name: "Error",
        message: "boom",
        stack: null,
        cause: null
      },
      timestamp: Date.now()
    };

    expect(isJourneyDevtoolsBridgeEnvelope(resultEnvelope)).toBe(true);
    expect(isJourneyDevtoolsBridgeEnvelope(errorEnvelope)).toBe(true);
    expect(isJourneyDevtoolsEnvelope(resultEnvelope)).toBe(true);
    expect(isJourneyDevtoolsEnvelope(errorEnvelope)).toBe(true);

    expect(
      isJourneyDevtoolsBridgeEnvelope({
        channel: JOURNEY_DEVTOOLS_CHANNEL,
        version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
        source: JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
        kind: "operationResult",
        machineId: "machine-1",
        requestId: "req-text",
        operationId: "custom.describe",
        result: {
          kind: "text",
          text: "ok"
        },
        timestamp: Date.now()
      })
    ).toBe(true);

    expect(
      isJourneyDevtoolsBridgeEnvelope({
        channel: JOURNEY_DEVTOOLS_CHANNEL,
        version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
        source: JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
        kind: "operationResult",
        machineId: "machine-1",
        requestId: "req-data",
        operationId: "custom.inspect",
        result: {
          kind: "data",
          data: { nested: ["a", "b"] }
        },
        timestamp: Date.now()
      })
    ).toBe(true);

    expect(
      isJourneyDevtoolsBridgeEnvelope({
        channel: JOURNEY_DEVTOOLS_CHANNEL,
        version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
        source: JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
        kind: "operationResult",
        machineId: "machine-1",
        requestId: "req-void",
        operationId: "custom.flush",
        result: {
          kind: "void"
        },
        timestamp: Date.now()
      })
    ).toBe(true);
  });

  it("rejects malformed result and error envelopes", () => {
    expect(
      isJourneyDevtoolsBridgeEnvelope({
        channel: JOURNEY_DEVTOOLS_CHANNEL,
        version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
        source: JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
        kind: "operationResult",
        machineId: "machine-1",
        requestId: "req-1",
        operationId: "core.goToNextStep",
        result: {
          kind: "snapshot",
          snapshot: undefined
        },
        timestamp: Date.now()
      })
    ).toBe(false);

    expect(
      isJourneyDevtoolsBridgeEnvelope({
        channel: JOURNEY_DEVTOOLS_CHANNEL,
        version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
        source: JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
        kind: "operationResult",
        machineId: "machine-1",
        requestId: "req-1",
        operationId: "core.goToNextStep",
        result: {
          kind: "void",
          extra: true
        },
        timestamp: Date.now()
      })
    ).toBe(false);

    expect(
      isJourneyDevtoolsBridgeEnvelope({
        channel: JOURNEY_DEVTOOLS_CHANNEL,
        version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
        source: JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
        kind: "operationError",
        machineId: "machine-1",
        requestId: "req-2",
        operationId: "core.goToNextStep",
        error: null,
        timestamp: Date.now()
      })
    ).toBe(false);
  });

  it("rejects unsafe invoke payloads and malformed request metadata", () => {
    let deepPayload: Record<string, unknown> = { leaf: true };
    for (let index = 0; index < 12; index += 1) {
      deepPayload = { nested: deepPayload };
    }

    expect(
      isJourneyDevtoolsExtensionEnvelope({
        channel: JOURNEY_DEVTOOLS_CHANNEL,
        version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
        source: JOURNEY_DEVTOOLS_EXTENSION_SOURCE,
        kind: "invoke",
        machineId: "machine-1",
        requestId: 7,
        invocation: { operationId: "core.patchContext" },
        timestamp: Date.now()
      })
    ).toBe(false);

    expect(
      isJourneyDevtoolsExtensionEnvelope({
        channel: JOURNEY_DEVTOOLS_CHANNEL,
        version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
        source: JOURNEY_DEVTOOLS_EXTENSION_SOURCE,
        kind: "invoke",
        machineId: "machine-1",
        requestId: "req-1",
        invocation: { operationId: "", input: { bad: true } },
        timestamp: Date.now()
      })
    ).toBe(false);

    expect(
      isJourneyDevtoolsExtensionEnvelope({
        channel: JOURNEY_DEVTOOLS_CHANNEL,
        version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
        source: JOURNEY_DEVTOOLS_EXTENSION_SOURCE,
        kind: "invoke",
        machineId: "machine-1",
        requestId: "req-2",
        invocation: {
          operationId: "x".repeat(201)
        },
        timestamp: Date.now()
      })
    ).toBe(false);

    expect(
      isJourneyDevtoolsExtensionEnvelope({
        channel: JOURNEY_DEVTOOLS_CHANNEL,
        version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
        source: JOURNEY_DEVTOOLS_EXTENSION_SOURCE,
        kind: "invoke",
        machineId: "machine-1",
        requestId: "req-3",
        invocation: {
          operationId: "core.patchContext",
          input: deepPayload
        },
        timestamp: Date.now()
      })
    ).toBe(false);

    expect(
      isJourneyDevtoolsExtensionEnvelope({
        channel: JOURNEY_DEVTOOLS_CHANNEL,
        version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
        source: JOURNEY_DEVTOOLS_EXTENSION_SOURCE,
        kind: "invoke",
        machineId: "machine-1",
        requestId: "req-4",
        invocation: {
          operationId: "core.patchContext",
          input: { fn: () => "nope" }
        },
        timestamp: Date.now()
      })
    ).toBe(false);

    expect(
      isJourneyDevtoolsExtensionEnvelope({
        channel: JOURNEY_DEVTOOLS_CHANNEL,
        version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
        source: JOURNEY_DEVTOOLS_EXTENSION_SOURCE,
        kind: "invoke",
        machineId: "machine-1",
        requestId: "req-5",
        invocation: {
          operationId: "core.patchContext",
          input: { data: "x".repeat(600_000) }
        },
        timestamp: Date.now()
      })
    ).toBe(false);
  });

  it("rejects payloads with circular or custom-prototype objects", () => {
    const circular: Record<string, unknown> = { ok: true };
    circular.self = circular;

    class CustomPayload {
      value = "bad";
    }

    expect(
      isJourneyDevtoolsExtensionEnvelope({
        channel: JOURNEY_DEVTOOLS_CHANNEL,
        version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
        source: JOURNEY_DEVTOOLS_EXTENSION_SOURCE,
        kind: "invoke",
        machineId: "machine-1",
        requestId: "req-circular",
        invocation: {
          operationId: "core.patchContext",
          input: circular
        },
        timestamp: Date.now()
      })
    ).toBe(false);

    expect(
      isJourneyDevtoolsExtensionEnvelope({
        channel: JOURNEY_DEVTOOLS_CHANNEL,
        version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
        source: JOURNEY_DEVTOOLS_EXTENSION_SOURCE,
        kind: "invoke",
        machineId: "machine-1",
        requestId: "req-class",
        invocation: {
          operationId: "core.patchContext",
          input: new CustomPayload()
        },
        timestamp: Date.now()
      })
    ).toBe(false);
  });

  it("rejects malformed machine metadata and result payload variants", () => {
    const baseEnvelope = {
      channel: JOURNEY_DEVTOOLS_CHANNEL,
      version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
      source: JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
      kind: "register",
      machineId: "machine-1",
      timestamp: Date.now()
    };

    expect(
      isJourneyDevtoolsBridgeEnvelope({
        ...baseEnvelope,
        meta: null,
        snapshot: {}
      })
    ).toBe(false);

    expect(
      isJourneyDevtoolsBridgeEnvelope({
        ...baseEnvelope,
        meta: {
          machineId: "machine-1",
          label: "Checkout",
          appName: "Store",
          mutationsEnabled: "yes",
          features: []
        },
        snapshot: {}
      })
    ).toBe(false);

    for (const fieldOverride of [{ min: "low" }, { max: "high" }]) {
      expect(
        isJourneyDevtoolsBridgeEnvelope({
          ...baseEnvelope,
          meta: {
            machineId: "machine-1",
            label: "Checkout",
            appName: "Store",
            mutationsEnabled: true,
            features: [
              {
                id: "core",
                label: "Core",
                description: null,
                operations: [
                  {
                    id: "core.run",
                    label: "run",
                    description: null,
                    mutates: true,
                    output: "snapshot",
                    fields: [
                      {
                        key: "value",
                        label: "value",
                        type: "integer",
                        ...fieldOverride
                      }
                    ]
                  }
                ]
              }
            ]
          },
          snapshot: {}
        })
      ).toBe(false);
    }

    expect(
      isJourneyDevtoolsBridgeEnvelope({
        ...baseEnvelope,
        meta: {
          machineId: "machine-1",
          label: "Checkout",
          appName: "Store",
          mutationsEnabled: true,
          features: [
            {
              id: "core",
              label: "Core",
              description: null,
              operations: [
                {
                  id: "core.run",
                  label: "run",
                  description: null,
                  mutates: true,
                  output: "snapshot",
                  fields: [null]
                }
              ]
            }
          ]
        },
        snapshot: {}
      })
    ).toBe(false);

    expect(
      isJourneyDevtoolsBridgeEnvelope({
        ...baseEnvelope,
        meta: {
          machineId: "machine-1",
          label: "Checkout",
          appName: "Store",
          mutationsEnabled: true,
          mode: "diagonal",
          features: []
        },
        snapshot: {}
      })
    ).toBe(false);

    expect(
      isJourneyDevtoolsBridgeEnvelope({
        ...baseEnvelope,
        meta: {
          machineId: "machine-1",
          label: "Checkout",
          appName: "Store",
          mutationsEnabled: true,
          features: [
            {
              id: "core",
              label: "Core",
              description: null,
              operations: [
                {
                  id: "core.run",
                  label: "run",
                  description: null,
                  mutates: true,
                  output: "snapshot",
                  fields: [
                    {
                      key: "value",
                      label: "value",
                      type: "text",
                      description: 1
                    }
                  ]
                }
              ]
            }
          ]
        },
        snapshot: {}
      })
    ).toBe(false);

    expect(
      isJourneyDevtoolsBridgeEnvelope({
        ...baseEnvelope,
        meta: {
          machineId: "machine-1",
          label: "Checkout",
          appName: "Store",
          mutationsEnabled: true,
          features: [
            {
              id: "core",
              label: "Core",
              description: null,
              operations: [
                {
                  id: "core.run",
                  label: "run",
                  description: null,
                  mutates: true,
                  output: "snapshot",
                  fields: [
                    {
                      key: "value",
                      label: "value",
                      type: "text",
                      placeholder: 1
                    }
                  ]
                }
              ]
            }
          ]
        },
        snapshot: {}
      })
    ).toBe(false);

    expect(
      isJourneyDevtoolsBridgeEnvelope({
        ...baseEnvelope,
        meta: {
          machineId: "machine-1",
          label: "Checkout",
          appName: "Store",
          mutationsEnabled: true,
          features: [
            {
              id: "core",
              label: "Core",
              description: null,
              operations: [
                {
                  id: "core.run",
                  label: "run",
                  description: 7,
                  mutates: true,
                  output: "snapshot",
                  fields: []
                }
              ]
            }
          ]
        },
        snapshot: {}
      })
    ).toBe(false);

    expect(
      isJourneyDevtoolsBridgeEnvelope({
        ...baseEnvelope,
        meta: {
          machineId: "machine-1",
          label: "Checkout",
          appName: "Store",
          mutationsEnabled: true,
          stepIds: ["start", 7],
          features: []
        },
        snapshot: {}
      })
    ).toBe(false);

    expect(
      isJourneyDevtoolsBridgeEnvelope({
        ...baseEnvelope,
        meta: {
          machineId: "machine-1",
          label: "Checkout",
          appName: "Store",
          mutationsEnabled: true,
          eventTypes: "submitLogin",
          features: []
        },
        snapshot: {}
      })
    ).toBe(false);

    expect(
      isJourneyDevtoolsBridgeEnvelope({
        ...baseEnvelope,
        meta: {
          machineId: "machine-1",
          label: "Checkout",
          appName: "Store",
          mutationsEnabled: true,
          goToStepTargetsBySource: {
            start: ["review", 9]
          },
          features: []
        },
        snapshot: {}
      })
    ).toBe(false);

    expect(
      isJourneyDevtoolsBridgeEnvelope({
        ...baseEnvelope,
        meta: {
          machineId: "machine-1",
          label: "Checkout",
          appName: "Store",
          mutationsEnabled: true,
          features: [
            {
              id: "core",
              label: "Core",
              description: null,
              operations: [
                {
                  id: "core.send",
                  label: "send",
                  description: null,
                  mutates: true,
                  output: "snapshot",
                  fields: [
                    {
                      key: "type",
                      label: "",
                      type: "text"
                    }
                  ]
                }
              ]
            }
          ]
        },
        snapshot: {}
      })
    ).toBe(false);

    expect(
      isJourneyDevtoolsBridgeEnvelope({
        ...baseEnvelope,
        meta: {
          machineId: "machine-1",
          label: "Checkout",
          appName: "Store",
          mutationsEnabled: true,
          features: [],
          goToStepTargetsBySource: { start: [1] }
        },
        snapshot: {}
      })
    ).toBe(false);

    expect(
      isJourneyDevtoolsBridgeEnvelope({
        ...baseEnvelope,
        meta: {
          machineId: "machine-1",
          label: "Checkout",
          appName: "Store",
          mutationsEnabled: true,
          features: [
            {
              id: "broken",
              label: "Broken",
              description: null,
              operations: "nope"
            }
          ]
        },
        snapshot: {}
      })
    ).toBe(false);

    expect(
      isJourneyDevtoolsBridgeEnvelope({
        ...baseEnvelope,
        meta: {
          machineId: "machine-1",
          label: "Checkout",
          appName: "Store",
          mutationsEnabled: true,
          features: [
            {
              id: "broken",
              label: "Broken",
              description: null,
              operations: [
                {
                  id: "broken.run",
                  label: "run",
                  description: null,
                  mutates: true,
                  output: "bad",
                  fields: []
                }
              ]
            }
          ]
        },
        snapshot: {}
      })
    ).toBe(false);

    expect(
      isJourneyDevtoolsBridgeEnvelope({
        channel: JOURNEY_DEVTOOLS_CHANNEL,
        version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
        source: JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
        kind: "operationResult",
        machineId: "machine-1",
        requestId: "req-data-class",
        operationId: "custom.inspect",
        result: {
          kind: "data",
          data: new (class NotPlain {
            value = "bad";
          })()
        },
        timestamp: Date.now()
      })
    ).toBe(false);

    expect(
      isJourneyDevtoolsBridgeEnvelope({
        channel: JOURNEY_DEVTOOLS_CHANNEL,
        version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
        source: JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
        kind: "operationResult",
        machineId: "machine-1",
        requestId: "req-unknown-result",
        operationId: "core.goToNextStep",
        result: {
          kind: "unknown"
        },
        timestamp: Date.now()
      })
    ).toBe(false);

    expect(
      isJourneyDevtoolsBridgeEnvelope({
        channel: JOURNEY_DEVTOOLS_CHANNEL,
        version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
        source: JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
        kind: "operationResult",
        machineId: "machine-1",
        requestId: "req-text-bad",
        operationId: "custom.describe",
        result: {
          kind: "text",
          text: 7
        },
        timestamp: Date.now()
      })
    ).toBe(false);

    expect(
      isJourneyDevtoolsBridgeEnvelope({
        channel: JOURNEY_DEVTOOLS_CHANNEL,
        version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
        source: JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
        kind: "operationResult",
        machineId: "machine-1",
        requestId: "req-kind",
        operationId: "core.goToNextStep",
        result: null,
        timestamp: Date.now()
      })
    ).toBe(false);

    expect(
      isJourneyDevtoolsExtensionEnvelope({
        channel: JOURNEY_DEVTOOLS_CHANNEL,
        version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
        source: JOURNEY_DEVTOOLS_EXTENSION_SOURCE,
        kind: "snapshot",
        machineId: "machine-1",
        requestId: "req-kind",
        invocation: { operationId: "core.goToNextStep" },
        timestamp: Date.now()
      })
    ).toBe(false);

    expect(
      isJourneyDevtoolsExtensionEnvelope({
        channel: JOURNEY_DEVTOOLS_CHANNEL,
        version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
        source: JOURNEY_DEVTOOLS_EXTENSION_SOURCE,
        kind: "invoke",
        machineId: "machine-1",
        requestId: "req-null",
        invocation: null,
        timestamp: Date.now()
      })
    ).toBe(false);
  });
});

describe("protocol v6", () => {
  const buildRegister = (version: number, steps?: unknown) => {
    const envelope = createRegisterEnvelope();
    return {
      ...envelope,
      version,
      meta: { ...envelope.meta, ...(steps === undefined ? {} : { steps }) }
    };
  };

  it("treats v6 as the current protocol version", () => {
    expect(JOURNEY_DEVTOOLS_PROTOCOL_VERSION).toBe(6);
    expect(JOURNEY_DEVTOOLS_PRIOR_PROTOCOL_VERSION).toBe(5);
  });

  it("accepts current (v6), prior (v5), and legacy (v3) register envelopes", () => {
    expect(isJourneyDevtoolsBridgeEnvelope(buildRegister(JOURNEY_DEVTOOLS_PROTOCOL_VERSION))).toBe(
      true
    );
    expect(
      isJourneyDevtoolsBridgeEnvelope(buildRegister(JOURNEY_DEVTOOLS_PRIOR_PROTOCOL_VERSION))
    ).toBe(true);
    expect(
      isJourneyDevtoolsBridgeEnvelope(buildRegister(JOURNEY_DEVTOOLS_LEGACY_PROTOCOL_VERSION))
    ).toBe(true);
    expect(isJourneyDevtoolsBridgeEnvelope(buildRegister(4))).toBe(false);
  });

  it("validates well-formed per-step feature descriptors", () => {
    const steps = {
      loading: {
        hasEffect: true,
        afterDelays: [1000, 5000],
        hasOnEnter: true,
        hasOnLeave: false,
        hasMeta: true
      }
    };
    expect(
      isJourneyDevtoolsBridgeEnvelope(buildRegister(JOURNEY_DEVTOOLS_PROTOCOL_VERSION, steps))
    ).toBe(true);
  });

  it("rejects malformed per-step feature descriptors", () => {
    expect(
      isJourneyDevtoolsBridgeEnvelope(
        buildRegister(JOURNEY_DEVTOOLS_PROTOCOL_VERSION, {
          loading: { hasEffect: true, afterDelays: ["soon"], hasOnEnter: true }
        })
      )
    ).toBe(false);
    expect(
      isJourneyDevtoolsBridgeEnvelope(buildRegister(JOURNEY_DEVTOOLS_PROTOCOL_VERSION, "nope"))
    ).toBe(false);
  });

  it("identifies protocol versions whose invokes can be processed", () => {
    expect(isCompatibleInvokeProtocolVersion(JOURNEY_DEVTOOLS_PROTOCOL_VERSION)).toBe(true);
    expect(isCompatibleInvokeProtocolVersion(JOURNEY_DEVTOOLS_PRIOR_PROTOCOL_VERSION)).toBe(true);
    expect(isCompatibleInvokeProtocolVersion(JOURNEY_DEVTOOLS_LEGACY_PROTOCOL_VERSION)).toBe(false);
    expect(isCompatibleInvokeProtocolVersion(4)).toBe(false);
  });
});
