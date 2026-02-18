import { afterEach, describe, expect, it, vi } from "vitest";

import type { JourneyMachine, JourneySnapshot, JourneyStepAsyncState } from "@rxova/journey-core";
import {
  JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
  JOURNEY_DEVTOOLS_CHANNEL,
  JOURNEY_DEVTOOLS_EXTENSION_SOURCE,
  JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
  attachJourneyDevtools,
  isJourneyDevtoolsBridgeEnvelope,
  type JourneyDevtoolsBridgeEnvelope,
  type JourneyDevtoolsExtensionEnvelope
} from "@rxova/journey-devtools-bridge";

type StepId = "start" | "review";

type Snapshot = JourneySnapshot<unknown, StepId>;

const createStepAsyncState = (): JourneyStepAsyncState => ({
  phase: "idle",
  eventType: null,
  transitionId: null,
  error: null
});

const createSnapshot = (current: StepId = "start", context: unknown = { count: 0 }): Snapshot => ({
  current,
  context,
  history: current === "start" ? [] : ["start"],
  visited: current === "start" ? ["start"] : ["start", "review"],
  status: "running",
  async: {
    isLoading: false,
    byStep: {
      start: createStepAsyncState(),
      review: createStepAsyncState()
    }
  }
});

const waitForMessages = async () => {
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
};

const collectBridgeMessages = () => {
  const messages: JourneyDevtoolsBridgeEnvelope[] = [];
  const listener = (event: MessageEvent<unknown>) => {
    if (isJourneyDevtoolsBridgeEnvelope(event.data)) {
      messages.push(event.data);
    }
  };

  window.addEventListener("message", listener);

  return {
    messages,
    stop: () => {
      window.removeEventListener("message", listener);
    }
  };
};

const buildCommandEnvelope = (
  machineId: string,
  requestId: string,
  command: JourneyDevtoolsExtensionEnvelope["command"]
): JourneyDevtoolsExtensionEnvelope => ({
  channel: JOURNEY_DEVTOOLS_CHANNEL,
  version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
  source: JOURNEY_DEVTOOLS_EXTENSION_SOURCE,
  kind: "command",
  machineId,
  requestId,
  command,
  timestamp: Date.now()
});

const createDeferred = <T>() => {
  let resolve: (value: T) => void = () => {};
  let reject: (reason?: unknown) => void = () => {};

  const promise = new Promise<T>((innerResolve, innerReject) => {
    resolve = innerResolve;
    reject = innerReject;
  });

  return { promise, resolve, reject };
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("attachJourneyDevtools coverage branches", () => {
  it("serializes snapshot metadata and fallback values when structuredClone is unavailable", async () => {
    vi.stubGlobal("structuredClone", undefined);
    const previousEnv = process.env.NODE_ENV;
    delete process.env.NODE_ENV;

    const circular: { self?: unknown; fn: () => void; sym: symbol; big: bigint } = {
      fn: function namedFn() {},
      sym: Symbol("demo"),
      big: BigInt(42)
    };
    circular.self = circular;

    const evaluateState: JourneyStepAsyncState = {
      phase: "evaluating-when",
      eventType: null,
      transitionId: null,
      error: BigInt(1)
    };
    const unknownPhaseState: JourneyStepAsyncState = {
      phase: "idle",
      eventType: null,
      transitionId: null,
      error: null
    };
    const byStep: Record<string, JourneyStepAsyncState> = {
      evaluate: evaluateState,
      running: {
        phase: "running-effect",
        eventType: "next",
        transitionId: "t-1",
        error: null
      },
      failed: {
        phase: "error",
        eventType: null,
        transitionId: null,
        error: { code: "E" }
      },
      unknownPhase: unknownPhaseState
    };

    Reflect.set(byStep, "ignored", 123);
    Reflect.set(evaluateState, "eventType", 1);
    Reflect.set(evaluateState, "transitionId", 2);
    Reflect.set(unknownPhaseState, "phase", "unexpected");

    const snapshot: JourneySnapshot<unknown, string> = {
      current: "start",
      context: {
        circular,
        flag: true
      },
      history: [],
      visited: ["start"],
      status: "running",
      async: {
        isLoading: false,
        byStep
      }
    };

    const machine: JourneyMachine<unknown, string, string> = {
      getSnapshot: () => snapshot,
      send: async () => ({ transitioned: false, snapshot }),
      updateContext: () => snapshot,
      clearStepError: () => snapshot,
      reset: () => snapshot,
      trimHistory: () => snapshot,
      clearHistory: () => snapshot,
      subscribe: () => () => {}
    };

    document.title = "Bridge Coverage App";
    const collector = collectBridgeMessages();

    const detach = attachJourneyDevtools(machine, {
      machineId: "   ",
      label: "   ",
      appName: "   ",
      enabled: true
    });
    await waitForMessages();

    const register = collector.messages.find((message) => message.kind === "register");
    expect(register).toBeDefined();

    if (register?.kind === "register") {
      expect(register.machineId).toMatch(/^journey-/);
      expect(register.meta.label).toBe("Journey Machine");
      expect(register.meta.appName).toBe("Bridge Coverage App");

      const context = register.snapshot.context as {
        circular: { fn: string; sym: string; big: string; self: string };
      };
      expect(context.circular.big).toBe("42");
      expect(context.circular.fn).toContain("[Function namedFn]");
      expect(context.circular.sym).toContain("Symbol(demo)");
      expect(context.circular.self).toBe("[Circular]");

      expect(register.snapshot.async.byStep.ignored).toBeUndefined();
      expect(register.snapshot.async.byStep.evaluate?.phase).toBe("evaluating-when");
      expect(register.snapshot.async.byStep.evaluate?.eventType).toBeNull();
      expect(register.snapshot.async.byStep.evaluate?.transitionId).toBeNull();
      expect(register.snapshot.async.byStep.evaluate?.error).toBe("1");
      expect(register.snapshot.async.byStep.running?.phase).toBe("running-effect");
      expect(register.snapshot.async.byStep.failed?.phase).toBe("error");
      expect(register.snapshot.async.byStep.unknownPhase?.phase).toBe("idle");
    }

    detach();
    collector.stop();
    process.env.NODE_ENV = previousEnv;
  });

  it("handles all command variants and optional transition fields", async () => {
    const snapshots = {
      start: createSnapshot("start", { count: 0 }),
      review: createSnapshot("review", { count: 1 })
    };

    const send = vi.fn<JourneyMachine<unknown, StepId, string>["send"]>(async (event) => {
      if (event.type === "back") {
        return { transitioned: false, snapshot: snapshots.start };
      }

      return {
        transitioned: true,
        snapshot:
          event.type === "goTo" && "to" in event && event.to === "start"
            ? snapshots.start
            : snapshots.review,
        transitionId: event.type
      };
    });

    const clearStepError = vi.fn(() => snapshots.review);
    const clearHistory = vi.fn(() => snapshots.review);
    const trimHistory = vi.fn(() => snapshots.review);
    const reset = vi.fn(() => snapshots.start);

    const machine: JourneyMachine<unknown, StepId, string> = {
      getSnapshot: () => snapshots.start,
      send,
      updateContext: () => snapshots.review,
      clearStepError,
      reset,
      trimHistory,
      clearHistory,
      subscribe: () => () => {}
    };

    const collector = collectBridgeMessages();
    const detach = attachJourneyDevtools(machine, { machineId: "m-commands" });
    await waitForMessages();

    const commands: Array<[string, JourneyDevtoolsExtensionEnvelope["command"]]> = [
      ["req-back", { type: "back" }],
      ["req-close", { type: "close" }],
      ["req-submit", { type: "submit" }],
      ["req-send", { type: "send", event: { type: "custom" } }],
      ["req-reset", { type: "reset" }],
      ["req-clear-none", { type: "clearStepError" }],
      ["req-clear-id", { type: "clearStepError", stepId: "review" }],
      ["req-clear-history", { type: "clearHistory" }],
      ["req-trim-null", { type: "trimHistory", maxHistory: null }],
      ["req-trim-value", { type: "trimHistory", maxHistory: 5 }]
    ];

    for (const [requestId, command] of commands) {
      window.dispatchEvent(
        new MessageEvent("message", {
          source: window,
          origin: window.location.origin,
          data: buildCommandEnvelope("m-commands", requestId, command)
        })
      );
      await waitForMessages();
    }
    await waitForMessages();

    const resultById = new Map(
      collector.messages
        .filter(
          (message): message is Extract<JourneyDevtoolsBridgeEnvelope, { kind: "commandResult" }> =>
            message.kind === "commandResult"
        )
        .map((message) => [message.requestId, message])
    );

    expect(resultById.has("req-back")).toBe(true);
    expect(resultById.has("req-close")).toBe(true);
    expect(resultById.has("req-submit")).toBe(true);
    expect(resultById.has("req-send")).toBe(true);
    expect(resultById.has("req-reset")).toBe(true);
    expect(resultById.has("req-clear-none")).toBe(true);
    expect(resultById.has("req-clear-id")).toBe(true);
    expect(resultById.has("req-clear-history")).toBe(true);
    expect(resultById.has("req-trim-null")).toBe(true);
    expect(resultById.has("req-trim-value")).toBe(true);

    const backResult = resultById.get("req-back");
    expect(backResult?.transitioned).toBe(false);
    expect(backResult && "transitionId" in backResult).toBe(false);

    expect(send).toHaveBeenCalledWith({ type: "back" });
    expect(send).toHaveBeenCalledWith({ type: "close" });
    expect(send).toHaveBeenCalledWith({ type: "submit" });
    expect(send).toHaveBeenCalledWith({ type: "custom" });

    expect(reset).toHaveBeenCalledTimes(1);
    expect(clearStepError).toHaveBeenCalledWith(undefined);
    expect(clearStepError).toHaveBeenCalledWith("review");
    expect(clearHistory).toHaveBeenCalledTimes(1);
    expect(trimHistory).toHaveBeenCalledWith(null);
    expect(trimHistory).toHaveBeenCalledWith(5);

    detach();
    collector.stop();
  });

  it("ignores non-window and non-command envelopes", async () => {
    const machine: JourneyMachine<unknown, StepId, string> = {
      getSnapshot: () => createSnapshot("start"),
      send: async () => ({
        transitioned: true,
        snapshot: createSnapshot("review"),
        transitionId: "next"
      }),
      updateContext: () => createSnapshot("review"),
      clearStepError: () => createSnapshot("review"),
      reset: () => createSnapshot("start"),
      trimHistory: () => createSnapshot("review"),
      clearHistory: () => createSnapshot("review"),
      subscribe: () => () => {}
    };

    const collector = collectBridgeMessages();
    const detach = attachJourneyDevtools(machine, { machineId: "m-ignore" });
    await waitForMessages();

    window.dispatchEvent(
      new MessageEvent("message", {
        source: null,
        data: buildCommandEnvelope("m-ignore", "req-null-source", { type: "next" })
      })
    );

    window.dispatchEvent(
      new MessageEvent("message", {
        source: window,
        origin: window.location.origin,
        data: {
          channel: JOURNEY_DEVTOOLS_CHANNEL,
          version: JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
          source: JOURNEY_DEVTOOLS_BRIDGE_SOURCE,
          kind: "snapshot",
          machineId: "m-ignore",
          snapshot: createSnapshot("start"),
          timestamp: Date.now()
        }
      })
    );

    await waitForMessages();

    const ignoredResult = collector.messages.find(
      (message) =>
        (message.kind === "commandResult" || message.kind === "commandError") &&
        "requestId" in message &&
        message.requestId === "req-null-source"
    );

    expect(ignoredResult).toBeUndefined();

    detach();
    collector.stop();
  });

  it("does not publish late command outcomes after detach and supports idempotent detach", async () => {
    const listeners = new Set<() => void>();
    const pendingResolve = createDeferred<{
      transitioned: boolean;
      snapshot: Snapshot;
      transitionId: string;
    }>();
    const pendingReject = createDeferred<{
      transitioned: boolean;
      snapshot: Snapshot;
      transitionId: string;
    }>();

    let callCount = 0;

    const machine: JourneyMachine<unknown, StepId, string> = {
      getSnapshot: () => createSnapshot("start"),
      send: () => {
        callCount += 1;
        return callCount === 1 ? pendingResolve.promise : pendingReject.promise;
      },
      updateContext: () => createSnapshot("review"),
      clearStepError: () => createSnapshot("review"),
      reset: () => createSnapshot("start"),
      trimHistory: () => createSnapshot("review"),
      clearHistory: () => createSnapshot("review"),
      subscribe: (listener) => {
        listeners.add(listener);
        return () => {};
      }
    };

    const collector = collectBridgeMessages();
    const detach = attachJourneyDevtools(machine, { machineId: "m-pending" });
    await waitForMessages();

    window.dispatchEvent(
      new MessageEvent("message", {
        source: window,
        origin: window.location.origin,
        data: buildCommandEnvelope("m-pending", "req-late-result", { type: "next" })
      })
    );
    window.dispatchEvent(
      new MessageEvent("message", {
        source: window,
        origin: window.location.origin,
        data: buildCommandEnvelope("m-pending", "req-late-error", { type: "next" })
      })
    );

    detach();
    detach();

    listeners.forEach((listener) => listener());

    pendingResolve.resolve({
      transitioned: true,
      snapshot: createSnapshot("review"),
      transitionId: "next"
    });
    pendingReject.reject(new Error("late failure"));

    await waitForMessages();
    await waitForMessages();

    const lateMessages = collector.messages.filter(
      (message) =>
        (message.kind === "commandResult" || message.kind === "commandError") &&
        "requestId" in message &&
        (message.requestId === "req-late-result" || message.requestId === "req-late-error")
    );

    expect(lateMessages).toHaveLength(0);

    const unregisterMessages = collector.messages.filter(
      (message) => message.kind === "unregister" && message.machineId === "m-pending"
    );
    expect(unregisterMessages).toHaveLength(1);

    collector.stop();
  });

  it("serializes non-Error command failures including JSON fallback failures", async () => {
    vi.stubGlobal("structuredClone", undefined);

    const badValue: { readonly broken?: unknown } = {};
    Object.defineProperty(badValue, "broken", {
      enumerable: true,
      get() {
        throw new Error("explode while serializing");
      }
    });

    let calls = 0;

    const machine: JourneyMachine<unknown, StepId, string> = {
      getSnapshot: () => createSnapshot("start"),
      send: async () => {
        calls += 1;
        if (calls === 1) {
          throw "string failure";
        }
        throw badValue;
      },
      updateContext: () => createSnapshot("review"),
      clearStepError: () => createSnapshot("review"),
      reset: () => createSnapshot("start"),
      trimHistory: () => createSnapshot("review"),
      clearHistory: () => createSnapshot("review"),
      subscribe: () => () => {}
    };

    const collector = collectBridgeMessages();
    const detach = attachJourneyDevtools(machine, { machineId: "m-errors" });
    await waitForMessages();

    window.dispatchEvent(
      new MessageEvent("message", {
        source: window,
        origin: window.location.origin,
        data: buildCommandEnvelope("m-errors", "req-str", { type: "next" })
      })
    );
    await waitForMessages();
    await waitForMessages();

    window.dispatchEvent(
      new MessageEvent("message", {
        source: window,
        origin: window.location.origin,
        data: buildCommandEnvelope("m-errors", "req-obj", { type: "next" })
      })
    );
    await waitForMessages();
    await waitForMessages();

    const stringError = collector.messages.find(
      (message): message is Extract<JourneyDevtoolsBridgeEnvelope, { kind: "commandError" }> =>
        message.kind === "commandError" && message.requestId === "req-str"
    );
    const objectError = collector.messages.find(
      (message): message is Extract<JourneyDevtoolsBridgeEnvelope, { kind: "commandError" }> =>
        message.kind === "commandError" && message.requestId === "req-obj"
    );

    expect(stringError?.error.message).toBe("string failure");
    expect(stringError?.error.cause).toBe("string failure");

    expect(objectError?.error.message).toBe("Unknown error");
    expect(objectError?.error.cause).toBe("[object Object]");

    detach();
    collector.stop();
  });
});
