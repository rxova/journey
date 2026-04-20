import { describe, expect, it } from "vitest";

import {
  JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
  JOURNEY_DEVTOOLS_CHANNEL,
  JOURNEY_DEVTOOLS_EXTENSION_SOURCE,
  JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
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
  });
});
