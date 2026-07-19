import { describe, expect, it } from "vitest";
import {
  JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
  JOURNEY_DEVTOOLS_CHANNEL,
  JOURNEY_DEVTOOLS_LEGACY_PROTOCOL_VERSION,
  JOURNEY_DEVTOOLS_PRIOR_PROTOCOL_VERSION,
  JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
  isCompatibleInvokeProtocolVersion,
  isJourneyDevtoolsBridgeEnvelope,
  isJourneyDevtoolsEnvelope,
  isJourneyDevtoolsExtensionEnvelope,
  type JourneyDevtoolsMachineMeta
} from "@rxova/journey-devtools-bridge";
import { buildInvokeEnvelope } from "@rxova/journey-devtools-bridge/testing";

const meta: JourneyDevtoolsMachineMeta = {
  machineId: "m1",
  label: "Checkout",
  appName: "Demo",
  mutationsEnabled: true,
  mode: "linear",
  stepIds: ["a", "b"],
  features: [
    {
      id: "navigation",
      label: "navigation",
      description: null,
      operations: [
        {
          id: "navigation.goToStepById",
          label: "goToStepById",
          description: null,
          mutates: true,
          output: "snapshot",
          fields: [{ key: "stepId", label: "Step id", type: "text", required: true }]
        }
      ]
    }
  ]
};

const base = {
  channel: JOURNEY_DEVTOOLS_CHANNEL,
  version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
  source: JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
  machineId: "m1",
  timestamp: 1
} as const;

describe("bridge envelope guard", () => {
  it("accepts every bridge envelope kind", () => {
    expect(
      isJourneyDevtoolsBridgeEnvelope({
        ...base,
        kind: "register",
        meta,
        snapshot: { status: "idle" }
      })
    ).toBe(true);
    expect(isJourneyDevtoolsBridgeEnvelope({ ...base, kind: "unregister" })).toBe(true);
    expect(
      isJourneyDevtoolsBridgeEnvelope({
        ...base,
        kind: "snapshot",
        snapshot: { status: "running" }
      })
    ).toBe(true);
    expect(
      isJourneyDevtoolsBridgeEnvelope({
        ...base,
        kind: "observation",
        event: { type: "stepEnter" }
      })
    ).toBe(true);
    expect(
      isJourneyDevtoolsBridgeEnvelope({
        ...base,
        kind: "operationResult",
        requestId: "r",
        operationId: "navigation.goToNextStep",
        result: { kind: "void" }
      })
    ).toBe(true);
    expect(
      isJourneyDevtoolsBridgeEnvelope({
        ...base,
        kind: "operationError",
        requestId: "r",
        operationId: "x",
        error: { name: "Error", message: "boom", stack: null, cause: null }
      })
    ).toBe(true);
  });

  it("rejects wrong channel, unknown kinds, and malformed meta", () => {
    expect(isJourneyDevtoolsBridgeEnvelope({ ...base, channel: "other", kind: "unregister" })).toBe(
      false
    );
    expect(isJourneyDevtoolsBridgeEnvelope({ ...base, kind: "mystery" })).toBe(false);
    expect(
      isJourneyDevtoolsBridgeEnvelope({
        ...base,
        kind: "register",
        meta: { ...meta, features: [{ id: "", label: "x", description: null, operations: [] }] },
        snapshot: {}
      })
    ).toBe(false);
    // v7 register requires mutationsEnabled
    const withoutMutations: Record<string, unknown> = { ...meta };
    delete withoutMutations.mutationsEnabled;
    expect(
      isJourneyDevtoolsBridgeEnvelope({
        ...base,
        kind: "register",
        meta: withoutMutations,
        snapshot: {}
      })
    ).toBe(false);
    // …but prior-version registers may omit it
    expect(
      isJourneyDevtoolsBridgeEnvelope({
        ...base,
        version: JOURNEY_DEVTOOLS_PRIOR_PROTOCOL_VERSION,
        kind: "register",
        meta: withoutMutations,
        snapshot: {}
      })
    ).toBe(true);
  });

  it("rejects unsafe payloads (class instances, excessive depth, oversized)", () => {
    class Exotic {}
    expect(
      isJourneyDevtoolsBridgeEnvelope({
        ...base,
        kind: "snapshot",
        snapshot: { weird: new Exotic() }
      })
    ).toBe(false);

    let deep: Record<string, unknown> = { leaf: true };
    for (let index = 0; index < 12; index += 1) deep = { nested: deep };
    expect(isJourneyDevtoolsBridgeEnvelope({ ...base, kind: "observation", event: deep })).toBe(
      false
    );

    expect(
      isJourneyDevtoolsBridgeEnvelope({
        ...base,
        kind: "observation",
        event: { blob: "x".repeat(500_001) }
      })
    ).toBe(false);
  });
});

describe("extension envelope guard", () => {
  it("accepts a well-formed invoke and the union guard recognises both directions", () => {
    const invoke = buildInvokeEnvelope("m1", "navigation.goToNextStep");
    expect(isJourneyDevtoolsExtensionEnvelope(invoke)).toBe(true);
    expect(isJourneyDevtoolsEnvelope(invoke)).toBe(true);
    expect(isJourneyDevtoolsEnvelope({ ...base, kind: "unregister" })).toBe(true);
    expect(isJourneyDevtoolsEnvelope(null)).toBe(false);
  });

  it("rejects invalid invocations", () => {
    expect(
      isJourneyDevtoolsExtensionEnvelope({ ...buildInvokeEnvelope("m1", ""), requestId: "r" })
    ).toBe(false);
    expect(isJourneyDevtoolsExtensionEnvelope(buildInvokeEnvelope("m1", "x".repeat(201)))).toBe(
      false
    );
    const bridgeSourced = {
      ...buildInvokeEnvelope("m1", "op"),
      source: JOURNEY_DEVTOOLS_BRIDGE_SOURCE
    };
    expect(isJourneyDevtoolsExtensionEnvelope(bridgeSourced)).toBe(false);
    expect(
      isJourneyDevtoolsExtensionEnvelope({
        ...buildInvokeEnvelope("m1", "op"),
        kind: "unregister"
      })
    ).toBe(false);
    expect(
      isJourneyDevtoolsExtensionEnvelope({
        ...buildInvokeEnvelope("m1", "op"),
        invocation: null
      })
    ).toBe(false);
  });
});

describe("protocol versions", () => {
  it("invokes are compatible for current and prior versions only", () => {
    expect(isCompatibleInvokeProtocolVersion(JOURNEY_DEVTOOLS_PROTOCOL_VERSION)).toBe(true);
    expect(isCompatibleInvokeProtocolVersion(JOURNEY_DEVTOOLS_PRIOR_PROTOCOL_VERSION)).toBe(true);
    expect(isCompatibleInvokeProtocolVersion(JOURNEY_DEVTOOLS_LEGACY_PROTOCOL_VERSION)).toBe(false);
    expect(isCompatibleInvokeProtocolVersion("7")).toBe(false);
  });
});

describe("operation result payload variants", () => {
  const resultEnvelope = (result: unknown) => ({
    ...base,
    kind: "operationResult",
    requestId: "r",
    operationId: "op",
    result
  });

  it("accepts data, text, and void payloads; rejects malformed ones", () => {
    expect(isJourneyDevtoolsBridgeEnvelope(resultEnvelope({ kind: "data", data: { a: 1 } }))).toBe(
      true
    );
    expect(isJourneyDevtoolsBridgeEnvelope(resultEnvelope({ kind: "text", text: "hi" }))).toBe(
      true
    );
    expect(isJourneyDevtoolsBridgeEnvelope(resultEnvelope({ kind: "void" }))).toBe(true);
    expect(isJourneyDevtoolsBridgeEnvelope(resultEnvelope({ kind: "void", extra: 1 }))).toBe(false);
    expect(isJourneyDevtoolsBridgeEnvelope(resultEnvelope({ kind: "mystery" }))).toBe(false);
    expect(isJourneyDevtoolsBridgeEnvelope(resultEnvelope({ kind: "text", text: 5 }))).toBe(false);
    expect(
      isJourneyDevtoolsBridgeEnvelope(
        resultEnvelope({ kind: "snapshot", snapshot: {}, transitioned: "yes" })
      )
    ).toBe(false);
    expect(isJourneyDevtoolsBridgeEnvelope(resultEnvelope("nope"))).toBe(false);
  });

  it("rejects circular and function-bearing payloads", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(isJourneyDevtoolsBridgeEnvelope(resultEnvelope({ kind: "data", data: circular }))).toBe(
      false
    );
    expect(
      isJourneyDevtoolsBridgeEnvelope(resultEnvelope({ kind: "data", data: { fn: () => 1 } }))
    ).toBe(false);
  });
});

describe("meta field validation", () => {
  const register = (metaOverrides: Record<string, unknown>) => ({
    ...base,
    kind: "register",
    meta: { ...meta, ...metaOverrides },
    snapshot: {}
  });

  it("validates optional meta fields", () => {
    expect(isJourneyDevtoolsBridgeEnvelope(register({ mode: "warp" }))).toBe(false);
    expect(isJourneyDevtoolsBridgeEnvelope(register({ stepIds: [1, 2] }))).toBe(false);
    expect(isJourneyDevtoolsBridgeEnvelope(register({ eventTypes: ["GO"] }))).toBe(true);
    expect(
      isJourneyDevtoolsBridgeEnvelope(
        register({ steps: { a: { hasOnEnter: true, hasOnLeave: false, hasMetadata: true } } })
      )
    ).toBe(true);
    expect(isJourneyDevtoolsBridgeEnvelope(register({ steps: { a: { hasOnEnter: "yes" } } }))).toBe(
      false
    );
    expect(isJourneyDevtoolsBridgeEnvelope(register({ appName: 5 }))).toBe(false);
    expect(isJourneyDevtoolsBridgeEnvelope(register({ features: null }))).toBe(false);
  });

  it("validates operation field descriptors", () => {
    const withField = (field: Record<string, unknown>) =>
      register({
        features: [
          {
            id: "f",
            label: "f",
            description: null,
            operations: [
              {
                id: "f.op",
                label: "op",
                description: null,
                mutates: false,
                output: "void",
                fields: [field]
              }
            ]
          }
        ]
      });
    expect(
      isJourneyDevtoolsBridgeEnvelope(withField({ key: "k", label: "K", type: "integer", min: 1 }))
    ).toBe(true);
    expect(isJourneyDevtoolsBridgeEnvelope(withField({ key: "k", label: "K", type: "date" }))).toBe(
      false
    );
    expect(isJourneyDevtoolsBridgeEnvelope(withField({ key: "", label: "K", type: "text" }))).toBe(
      false
    );
    expect(
      isJourneyDevtoolsBridgeEnvelope(
        withField({ key: "k", label: "K", type: "text", required: "y" })
      )
    ).toBe(false);
    expect(isJourneyDevtoolsBridgeEnvelope(withField(null as never))).toBe(false);
    expect(
      isJourneyDevtoolsBridgeEnvelope(
        withField({
          key: "k",
          label: "K",
          type: "integer",
          required: false,
          description: "Count",
          placeholder: "0",
          min: 0,
          max: 10
        })
      )
    ).toBe(true);
    expect(
      isJourneyDevtoolsBridgeEnvelope(
        register({
          features: [
            {
              id: "f",
              label: "f",
              description: null,
              operations: [null]
            }
          ]
        })
      )
    ).toBe(false);
  });

  it("rejects invokes with unsafe input payloads", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(isJourneyDevtoolsExtensionEnvelope(buildInvokeEnvelope("m1", "op", circular))).toBe(
      false
    );
    expect(isJourneyDevtoolsExtensionEnvelope(buildInvokeEnvelope("m1", "op", { ok: true }))).toBe(
      true
    );
  });
});

describe("guard sub-branches", () => {
  it("accepts undefined data payloads and string descriptions", () => {
    expect(
      isJourneyDevtoolsBridgeEnvelope({
        ...base,
        kind: "operationResult",
        requestId: "r",
        operationId: "op",
        result: { kind: "data", data: undefined }
      })
    ).toBe(true);
    expect(
      isJourneyDevtoolsBridgeEnvelope({
        ...base,
        kind: "register",
        meta: {
          ...meta,
          features: [
            {
              id: "f",
              label: "F",
              description: "documented feature",
              operations: [
                {
                  id: "f.op",
                  label: "op",
                  description: "documented op",
                  mutates: false,
                  output: "text",
                  fields: []
                }
              ]
            }
          ]
        },
        snapshot: {}
      })
    ).toBe(true);
  });

  it("rejects structurally wrong feature and step collections", () => {
    expect(
      isJourneyDevtoolsBridgeEnvelope({
        ...base,
        kind: "register",
        meta: { ...meta, features: [{ id: "f", label: "F", description: null, operations: "x" }] },
        snapshot: {}
      })
    ).toBe(false);
    expect(
      isJourneyDevtoolsBridgeEnvelope({
        ...base,
        kind: "register",
        meta: { ...meta, steps: { a: 5 } },
        snapshot: {}
      })
    ).toBe(false);
    expect(
      isJourneyDevtoolsExtensionEnvelope({ ...buildInvokeEnvelope("m1", "op"), requestId: 5 })
    ).toBe(false);
  });
});
