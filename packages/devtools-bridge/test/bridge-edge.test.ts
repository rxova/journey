import { afterEach, describe, expect, it, vi } from "vitest";

import { attachJourneyDevtools } from "@rxova/journey-devtools-bridge";

import { resolveNonProductionEnvironment } from "../src/bridge";
import {
  buildCommandEnvelope,
  collectBridgeMessages,
  createTestMachine,
  createTestSnapshot,
  waitForCollector,
  waitForMessages,
  type TestContext,
  type TestSnapshot
} from "./helpers";

describe("bridge edge coverage", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalStructuredClone = globalThis.structuredClone;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    Object.defineProperty(globalThis, "structuredClone", {
      configurable: true,
      writable: true,
      value: originalStructuredClone
    });
    vi.unstubAllGlobals();
  });

  it("resolves non-production state from bundler and node fallbacks", () => {
    expect(
      resolveNonProductionEnvironment({ bundlerEnv: { DEV: true }, nodeEnv: "production" })
    ).toBe(true);
    expect(
      resolveNonProductionEnvironment({ bundlerEnv: { PROD: true }, nodeEnv: "development" })
    ).toBe(false);
    expect(resolveNonProductionEnvironment({ bundlerEnv: null, nodeEnv: "development" })).toBe(
      true
    );
    expect(resolveNonProductionEnvironment({ bundlerEnv: null, nodeEnv: undefined })).toBe(false);
  });

  it("sanitizes snapshot payloads for transport", async () => {
    const collector = collectBridgeMessages();
    const machine = createTestMachine();

    Object.defineProperty(globalThis, "structuredClone", {
      configurable: true,
      writable: true,
      value: (value: unknown) => value
    });

    const detach = attachJourneyDevtools(machine, {
      machineId: "edge-snapshot",
      enabled: true
    });

    await waitForMessages();

    const nextSnapshot = {
      ...createTestSnapshot("review", 1),
      context: {
        count: 1n,
        createdAt: new Date("2026-03-07T08:00:00.000Z"),
        helper() {
          return "formatted";
        }
      } as unknown as TestContext,
      async: {
        isLoading: true,
        byStep: {
          ...createTestSnapshot().async.byStep,
          guard: {
            phase: "evaluating-when",
            eventType: "goToNextStep",
            transitionId: "t-1",
            error: null
          },
          handler: {
            phase: "error",
            eventType: "goToNextStep",
            transitionId: "t-2",
            error: {
              total: 5n,
              createdAt: new Date("2026-03-07T08:05:00.000Z"),
              retry() {
                return "retry";
              }
            }
          }
        }
      }
    } as unknown as TestSnapshot;

    machine.setSnapshot(nextSnapshot);
    machine.notify();

    await waitForCollector(() =>
      collector.messages.some(
        (message) => message.kind === "snapshot" && message.machineId === "edge-snapshot"
      )
    );

    const snapshotMessage = collector.messages.find(
      (message) => message.kind === "snapshot" && message.machineId === "edge-snapshot"
    );

    expect(snapshotMessage?.kind).toBe("snapshot");
    if (snapshotMessage?.kind === "snapshot") {
      expect(snapshotMessage.snapshot.context).toEqual({
        count: "1",
        createdAt: "2026-03-07T08:00:00.000Z",
        helper: "[Function helper]"
      });
      expect(snapshotMessage.snapshot.async.byStep.guard?.phase).toBe("evaluating-when");
      expect(snapshotMessage.snapshot.async.byStep.handler?.error).toEqual({
        total: "5",
        createdAt: "2026-03-07T08:05:00.000Z",
        retry: "[Function retry]"
      });
    }

    detach();
    collector.stop();
  });

  it("ignores commands from an unexpected origin", async () => {
    const collector = collectBridgeMessages();
    const machine = createTestMachine();

    const detach = attachJourneyDevtools(machine, {
      machineId: "edge-origin",
      enabled: true
    });

    await waitForMessages();

    window.dispatchEvent(
      buildCommandEnvelope(
        "edge-origin",
        "req-origin",
        { type: "goToNextStep" },
        "https://example.com"
      )
    );

    await waitForMessages();

    expect(
      collector.messages.filter(
        (message) => message.kind === "commandResult" || message.kind === "commandError"
      )
    ).toHaveLength(0);

    detach();
    collector.stop();
  });

  it("serializes thrown command errors", async () => {
    const collector = collectBridgeMessages();
    const machine = createTestMachine({
      sendImpl: async () => {
        throw new Error("bridge boom");
      }
    });

    const detach = attachJourneyDevtools(machine, {
      machineId: "edge-error",
      enabled: true
    });

    await waitForMessages();

    window.dispatchEvent(buildCommandEnvelope("edge-error", "req-error", { type: "goToNextStep" }));

    await waitForCollector(() =>
      collector.messages.some(
        (message) => message.kind === "commandError" && message.requestId === "req-error"
      )
    );

    const error = collector.messages.find(
      (message) => message.kind === "commandError" && message.requestId === "req-error"
    );

    expect(error?.kind).toBe("commandError");
    if (error?.kind === "commandError") {
      expect(error.error.message).toBe("bridge boom");
      expect(error.error.name).toBe("Error");
    }

    detach();
    collector.stop();
  });
});
