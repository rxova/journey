import { afterEach, describe, expect, it, vi } from "vitest";

import { attachJourneyDevtools } from "@rxova/journey-devtools-bridge";

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

describe("bridge extra coverage", () => {
  const originalStructuredClone = globalThis.structuredClone;
  const originalRequestAnimationFrame = window.requestAnimationFrame;
  const originalCancelAnimationFrame = window.cancelAnimationFrame;

  afterEach(() => {
    Object.defineProperty(globalThis, "structuredClone", {
      configurable: true,
      writable: true,
      value: originalStructuredClone
    });
    Object.defineProperty(window, "requestAnimationFrame", {
      configurable: true,
      writable: true,
      value: originalRequestAnimationFrame
    });
    Object.defineProperty(window, "cancelAnimationFrame", {
      configurable: true,
      writable: true,
      value: originalCancelAnimationFrame
    });
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("serializes transition.error observations and trimmed persistence metadata", async () => {
    document.title = "Journey Docs";
    const collector = collectBridgeMessages();
    const machine = createTestMachine();

    const detach = attachJourneyDevtools(machine, {
      machineId: "  edge-meta  ",
      label: "  Checkout  ",
      appName: "  Storefront  ",
      enabled: true,
      pluginMetadata: {
        persistence: {
          key: "  session-cache  ",
          clearOnReset: false
        }
      }
    });

    await waitForMessages();

    const register = collector.messages.find((message) => message.kind === "register");
    expect(register?.kind).toBe("register");
    if (register?.kind === "register") {
      expect(register.meta.machineId).toBe("edge-meta");
      expect(register.meta.label).toBe("Checkout");
      expect(register.meta.appName).toBe("Storefront");
      expect(register.meta.capabilities?.persistence).toEqual({
        key: "session-cache",
        clearOnReset: false
      });
    }

    machine.emitObservation({
      type: "transition.error",
      from: "start",
      eventType: "goToNextStep",
      transitionId: "t-edge",
      error: new Error("observation boom"),
      timestamp: 1
    });

    await waitForCollector(() =>
      collector.messages.some(
        (message) => message.kind === "observation" && message.machineId === "edge-meta"
      )
    );

    const observation = collector.messages.find((message) => message.kind === "observation");
    expect(observation?.kind).toBe("observation");
    if (observation?.kind === "observation" && observation.event.type === "transition.error") {
      expect(observation.event.error).toMatchObject({
        name: "Error",
        message: "observation boom"
      });
    }

    detach();
    collector.stop();
  });

  it("runs the remaining command variants and validates clearStepError step ids", async () => {
    const collector = collectBridgeMessages();
    const machine = createTestMachine();
    const clearStepError = vi.fn(async () => machine.getSnapshot());
    machine.clearStepError = clearStepError;

    const detach = attachJourneyDevtools(machine, {
      machineId: "edge-commands",
      enabled: true
    });

    await waitForMessages();

    const commands = [
      buildCommandEnvelope("edge-commands", "req-start", { type: "startJourney" }),
      buildCommandEnvelope("edge-commands", "req-prev", { type: "goToPreviousStep", steps: 2 }),
      buildCommandEnvelope("edge-commands", "req-last", { type: "goToLastVisitedStep" }),
      buildCommandEnvelope("edge-commands", "req-complete", { type: "completeJourney" }),
      buildCommandEnvelope("edge-commands", "req-term", { type: "terminateJourney" }),
      buildCommandEnvelope("edge-commands", "req-goto", { type: "goToStepById", stepId: "guard" }),
      buildCommandEnvelope("edge-commands", "req-clear", {
        type: "clearStepError",
        stepId: "review"
      }),
      buildCommandEnvelope("edge-commands", "req-clear-current", { type: "clearStepError" })
    ];

    for (const command of commands) {
      window.dispatchEvent(command);
    }

    await waitForCollector(
      () => collector.messages.filter((message) => message.kind === "commandResult").length >= 8
    );

    const results = collector.messages.filter((message) => message.kind === "commandResult");
    expect(results).toHaveLength(8);
    expect(clearStepError).toHaveBeenNthCalledWith(1, "review");
    expect(clearStepError).toHaveBeenNthCalledWith(2, undefined);
    expect(
      results.some(
        (message) =>
          message.kind === "commandResult" &&
          message.requestId === "req-term" &&
          message.transitionId === "terminateJourney"
      )
    ).toBe(true);

    detach();
    collector.stop();
  });

  it("returns command errors for unsupported execution path queries and swallowed post failures", async () => {
    const machine = createTestMachine();
    const postSpy = vi.spyOn(window, "postMessage").mockImplementation(() => {
      throw new Error("transport failed");
    });

    expect(() =>
      attachJourneyDevtools(machine, {
        machineId: "edge-post-failure",
        enabled: true
      })
    ).not.toThrow();

    postSpy.mockRestore();

    const collector = collectBridgeMessages();
    const detach = attachJourneyDevtools(machine, {
      machineId: "edge-no-paths",
      enabled: true
    });

    await waitForMessages();

    window.dispatchEvent(
      buildCommandEnvelope("edge-no-paths", "req-no-paths", { type: "getExecutionPaths" })
    );

    await waitForCollector(() =>
      collector.messages.some(
        (message) => message.kind === "commandError" && message.requestId === "req-no-paths"
      )
    );

    const error = collector.messages.find(
      (message) => message.kind === "commandError" && message.requestId === "req-no-paths"
    );
    expect(error?.kind).toBe("commandError");
    if (error?.kind === "commandError") {
      expect(error.error.message).toContain('does not support "getExecutionPaths"');
    }

    detach();
    collector.stop();
  });

  it("cancels scheduled snapshots on detach when requestAnimationFrame is unavailable", async () => {
    vi.useFakeTimers();
    Object.defineProperty(window, "requestAnimationFrame", {
      configurable: true,
      writable: true,
      value: undefined
    });
    Object.defineProperty(window, "cancelAnimationFrame", {
      configurable: true,
      writable: true,
      value: undefined
    });

    const collector = collectBridgeMessages();
    const machine = createTestMachine();

    const detach = attachJourneyDevtools(machine, {
      machineId: "edge-timeout-snapshot",
      enabled: true
    });

    machine.setSnapshot(createTestSnapshot("review", 1));
    machine.notify();
    detach();
    detach();
    await vi.runAllTimersAsync();

    expect(
      collector.messages.filter(
        (message) => message.kind === "snapshot" && message.machineId === "edge-timeout-snapshot"
      )
    ).toHaveLength(0);
    expect(
      collector.messages.filter(
        (message) => message.kind === "unregister" && message.machineId === "edge-timeout-snapshot"
      )
    ).toHaveLength(1);

    collector.stop();
  });

  it("sanitizes snapshot transport when structuredClone is unavailable", async () => {
    const collector = collectBridgeMessages();
    const machine = createTestMachine();

    Object.defineProperty(globalThis, "structuredClone", {
      configurable: true,
      writable: true,
      value: undefined
    });

    const detach = attachJourneyDevtools(machine, {
      machineId: "edge-transport",
      enabled: true
    });

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
          review: {
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
        (message) => message.kind === "snapshot" && message.machineId === "edge-transport"
      )
    );

    const snapshotMessage = collector.messages.find(
      (message) => message.kind === "snapshot" && message.machineId === "edge-transport"
    );

    expect(snapshotMessage?.kind).toBe("snapshot");
    if (snapshotMessage?.kind === "snapshot") {
      expect(snapshotMessage.snapshot.context).toEqual({
        count: "1",
        createdAt: "2026-03-07T08:00:00.000Z",
        helper: "[Function helper]"
      });
      expect(snapshotMessage.snapshot.async.byStep.review?.error).toEqual({
        total: "5",
        createdAt: "2026-03-07T08:05:00.000Z",
        retry: "[Function retry]"
      });
    }

    detach();
    collector.stop();
  });
  it("drops async command results after detach", async () => {
    let resolveSend!: (value: {
      transitioned: boolean;
      snapshot: ReturnType<typeof createTestSnapshot>;
      transitionId?: string;
    }) => void;
    const sendPromise = new Promise<{
      transitioned: boolean;
      snapshot: ReturnType<typeof createTestSnapshot>;
      transitionId?: string;
    }>((resolve) => {
      resolveSend = resolve;
    });
    const collector = collectBridgeMessages();
    const machine = createTestMachine({
      sendImpl: async () => sendPromise
    });

    const detach = attachJourneyDevtools(machine, {
      machineId: "edge-detach-result",
      enabled: true
    });

    await waitForMessages();

    window.dispatchEvent(
      buildCommandEnvelope("edge-detach-result", "req-detach-result", { type: "goToNextStep" })
    );
    detach();
    resolveSend({
      transitioned: true,
      snapshot: createTestSnapshot("review", 1),
      transitionId: "goToNextStep"
    });
    await waitForMessages();

    expect(
      collector.messages.some(
        (message) => message.kind === "commandResult" && message.requestId === "req-detach-result"
      )
    ).toBe(false);

    collector.stop();
  });

  it("drops async command errors after detach", async () => {
    let rejectSend!: (error: unknown) => void;
    const sendPromise = new Promise<never>((_resolve, reject) => {
      rejectSend = reject;
    });
    const collector = collectBridgeMessages();
    const machine = createTestMachine({
      sendImpl: async () => sendPromise
    });

    const detach = attachJourneyDevtools(machine, {
      machineId: "edge-detach-error",
      enabled: true
    });

    await waitForMessages();

    window.dispatchEvent(
      buildCommandEnvelope("edge-detach-error", "req-detach-error", { type: "goToNextStep" })
    );
    detach();
    rejectSend(new Error("delayed boom"));
    await waitForMessages();

    expect(
      collector.messages.some(
        (message) => message.kind === "commandError" && message.requestId === "req-detach-error"
      )
    ).toBe(false);

    collector.stop();
  });

  it("ignores malformed and non-command envelopes", async () => {
    const collector = collectBridgeMessages();
    const machine = createTestMachine();

    const detach = attachJourneyDevtools(machine, {
      machineId: "edge-invalid-envelope",
      enabled: true
    });

    await waitForMessages();

    window.dispatchEvent(
      new MessageEvent("message", {
        source: window,
        origin: window.location.origin,
        data: { channel: "wrong" }
      })
    );
    window.dispatchEvent(
      new MessageEvent("message", {
        source: window,
        origin: window.location.origin,
        data: {
          channel: "journey-devtools",
          version: 4,
          source: "bridge",
          kind: "snapshot",
          machineId: "edge-invalid-envelope",
          timestamp: Date.now()
        }
      })
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

  it("enforces the command rate limit", async () => {
    const collector = collectBridgeMessages();
    const machine = createTestMachine();

    const detach = attachJourneyDevtools(machine, {
      machineId: "edge-rate-limit",
      enabled: true
    });

    await waitForMessages();

    for (let index = 0; index <= 100; index += 1) {
      window.dispatchEvent(
        buildCommandEnvelope("edge-rate-limit", `req-rate-${index}`, { type: "goToNextStep" })
      );
    }

    await waitForCollector(() =>
      collector.messages.some(
        (message) => message.kind === "commandError" && message.requestId === "req-rate-100"
      )
    );

    const error = collector.messages.find(
      (message) => message.kind === "commandError" && message.requestId === "req-rate-100"
    );
    expect(error?.kind).toBe("commandError");
    if (error?.kind === "commandError") {
      expect(error.error.message).toContain("rate limit exceeded");
    }

    detach();
    collector.stop();
  });

  it("ignores snapshot and observation notifications after detach", async () => {
    const collector = collectBridgeMessages();
    const machine = createTestMachine();

    const detach = attachJourneyDevtools(machine, {
      machineId: "edge-detached-listeners",
      enabled: true
    });

    await waitForMessages();
    detach();
    await waitForMessages();
    const messageCount = collector.messages.length;

    machine.setSnapshot(createTestSnapshot("review", 1));
    machine.notify();
    machine.emitObservation({
      type: "journey.start",
      stepId: "start",
      timestamp: Date.now()
    });
    await waitForMessages();

    expect(collector.messages).toHaveLength(messageCount);

    collector.stop();
  });

  it("defaults machine metadata and normalizes blank persistence metadata", async () => {
    document.title = "";
    const collector = collectBridgeMessages();
    const machine = createTestMachine();

    const detach = attachJourneyDevtools(machine, {
      enabled: true,
      pluginMetadata: {
        persistence: {
          key: "   "
        }
      }
    });

    await waitForMessages();

    const register = collector.messages.find((message) => message.kind === "register");
    expect(register?.kind).toBe("register");
    if (register?.kind === "register") {
      expect(register.meta.machineId).toMatch(/^journey-/);
      expect(register.meta.label).toBe("Journey Machine");
      expect(register.meta.appName).toBeNull();
      expect(register.meta.capabilities?.persistence).toEqual({
        key: null,
        clearOnReset: null
      });
    }

    detach();
    collector.stop();
  });

  it("handles payloadless send commands and forwards soft send errors in command results", async () => {
    const collector = collectBridgeMessages();
    const send = vi.fn(async (event: { type: string }) => ({
      transitioned: false,
      snapshot: createTestSnapshot(),
      error: new Error(`soft ${event.type} failure`)
    }));
    const machine = createTestMachine({
      sendImpl: send as never
    });

    const detach = attachJourneyDevtools(machine, {
      machineId: "edge-payloadless-send",
      enabled: true
    });

    await waitForMessages();

    window.dispatchEvent(
      buildCommandEnvelope("edge-payloadless-send", "req-soft-send", {
        type: "send",
        event: { type: "resolve" }
      } as never)
    );

    await waitForCollector(() =>
      collector.messages.some(
        (message) => message.kind === "commandResult" && message.requestId === "req-soft-send"
      )
    );

    expect(send).toHaveBeenCalledWith({ type: "resolve" });

    const result = collector.messages.find(
      (message) => message.kind === "commandResult" && message.requestId === "req-soft-send"
    );
    expect(result?.kind).toBe("commandResult");
    if (result?.kind === "commandResult") {
      expect(result.transitioned).toBe(false);
      expect(result.transitionId).toBeUndefined();
      expect(result.error).toMatchObject({
        name: "Error",
        message: "soft resolve failure"
      });
    }

    detach();
    collector.stop();
  });

  it("ignores commands with empty origins and stays inert when disabled", async () => {
    const disabledCollector = collectBridgeMessages();
    const disabledMachine = createTestMachine();
    const disabledDetach = attachJourneyDevtools(disabledMachine, {
      machineId: "edge-disabled",
      enabled: false
    });

    await waitForMessages();
    expect(
      disabledCollector.messages.some((message) => message.machineId === "edge-disabled")
    ).toBe(false);
    expect(() => disabledDetach()).not.toThrow();
    disabledCollector.stop();

    const collector = collectBridgeMessages();
    const machine = createTestMachine();
    const detach = attachJourneyDevtools(machine, {
      machineId: "edge-empty-origin",
      enabled: true
    });

    await waitForMessages();

    window.dispatchEvent(
      new MessageEvent("message", {
        source: window,
        origin: "",
        data: {
          channel: "journey-devtools",
          version: 4,
          source: "journey-devtools-extension",
          kind: "command",
          machineId: "edge-empty-origin",
          requestId: "req-empty-origin",
          command: { type: "goToNextStep" },
          timestamp: Date.now()
        }
      })
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
});
