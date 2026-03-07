import { afterEach, describe, expect, it, vi } from "vitest";

import type { JourneyMachine, JourneySnapshot } from "@rxova/journey-core";
import {
  JOURNEY_DEVTOOLS_CHANNEL,
  JOURNEY_DEVTOOLS_EXTENSION_SOURCE,
  JOURNEY_DEVTOOLS_PROTOCOL_VERSION,
  attachJourneyDevtools,
  isJourneyDevtoolsBridgeEnvelope,
  type JourneyDevtoolsBridgeEnvelope,
  type JourneyDevtoolsExtensionEnvelope
} from "@rxova/journey-devtools-bridge";

type StepId = "start" | "review";
type Event = "goToNextStep" | "back" | "terminateMachine" | "completeJourney" | "custom";
type Context = { count: number };

type Snapshot = JourneySnapshot<Context, StepId>;

const createSnapshot = (current: StepId = "start", index = 0): Snapshot => ({
  currentStepId: current,
  history: {
    timeline: index === 0 ? ["start"] : ["start", "review"],
    index
  },
  context: { count: index },
  visited: { start: true, review: true },
  stepMeta: {
    start: undefined,
    review: undefined
  },
  status: "running",
  async: {
    isLoading: false,
    byStep: {
      start: { phase: "idle", eventType: null, transitionId: null, error: null },
      review: { phase: "idle", eventType: null, transitionId: null, error: null }
    }
  }
});

const waitForMessages = async () => {
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
};

const waitForCollector = async (predicate: () => boolean, timeoutMs = 200): Promise<void> => {
  const startedAt = Date.now();
  while (!predicate()) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error("Timed out waiting for devtools bridge message.");
    }
    await waitForMessages();
  }
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

const createMachine = () => {
  let snapshot = createSnapshot();
  const listeners = new Set<() => void>();

  const machine: JourneyMachine<Context, StepId, Event> = {
    getSnapshot: () => snapshot,
    send: async (event) => {
      if (event.type === "goToNextStep") {
        snapshot = createSnapshot("review", 1);
      }
      if (event.type === "goToStepById") {
        snapshot = createSnapshot(
          event.stepId === "review" ? "review" : "start",
          event.stepId === "review" ? 1 : 0
        );
      }
      listeners.forEach((listener) => listener());
      return { transitioned: true, snapshot, transitionId: event.type };
    },
    goToNextStep: async () => {
      snapshot = createSnapshot("review", 1);
      listeners.forEach((listener) => listener());
      return { transitioned: true, snapshot, transitionId: "goToNextStep" };
    },
    terminateJourney: async () => {
      listeners.forEach((listener) => listener());
      return { transitioned: true, snapshot, transitionId: "terminateJourney" };
    },
    completeJourney: async () => {
      listeners.forEach((listener) => listener());
      return { transitioned: true, snapshot, transitionId: "completeJourney" };
    },
    goToPreviousStep: async () => {
      snapshot = createSnapshot("start", 0);
      listeners.forEach((listener) => listener());
      return { transitioned: true, snapshot, transitionId: "goToPreviousStep" };
    },
    goToLastVisitedStep: async () => {
      snapshot = createSnapshot("review", 1);
      listeners.forEach((listener) => listener());
      return { transitioned: true, snapshot, transitionId: "goToLastVisitedStep" };
    },
    updateContext: (updater) => {
      snapshot = { ...snapshot, context: updater(snapshot.context) };
      listeners.forEach((listener) => listener());
      return snapshot;
    },
    updateStepMetadata: (stepId, updater) => {
      const nextStepMeta = {
        ...snapshot.stepMeta,
        [stepId]: updater(snapshot.stepMeta[stepId as StepId])
      };
      snapshot = {
        ...snapshot,
        stepMeta: nextStepMeta
      };
      listeners.forEach((listener) => listener());
      return snapshot;
    },
    clearStepError: () => snapshot,
    resetMachine: () => {
      snapshot = createSnapshot("start", 0);
      listeners.forEach((listener) => listener());
      return snapshot;
    },
    dispose: () => undefined,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    subscribeSelector: () => () => undefined,
    subscribeEvent: () => () => undefined,
    subscribeStart: () => () => undefined,
    subscribeComplete: () => () => undefined,
    subscribeTerminate: () => () => undefined
  };

  return {
    machine,
    triggerChange: () => {
      listeners.forEach((listener) => listener());
    }
  };
};

describe("attachJourneyDevtools", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it("registers, emits snapshots, and unregisters", async () => {
    const collector = collectBridgeMessages();
    const { machine, triggerChange } = createMachine();

    const detach = attachJourneyDevtools(machine, {
      machineId: "m-1",
      label: "Checkout",
      enabled: true
    });

    await waitForMessages();
    expect(collector.messages[0]?.kind).toBe("register");

    if (collector.messages[0]?.kind === "register") {
      expect(collector.messages[0].snapshot.history.timeline).toEqual(["start"]);
      expect(collector.messages[0].snapshot.history.index).toBe(0);
      expect(collector.messages[0].meta.machineId).toBe("m-1");
      expect(collector.messages[0].meta.label).toBe("Checkout");
    }

    triggerChange();
    await waitForCollector(() =>
      collector.messages.some(
        (message) => message.kind === "snapshot" && message.machineId === "m-1"
      )
    );

    detach();
    await waitForMessages();

    expect(collector.messages[collector.messages.length - 1]?.kind).toBe("unregister");
    collector.stop();
  });

  it("coalesces burst snapshots to one frame and emits the latest snapshot", async () => {
    const collector = collectBridgeMessages();
    const { machine } = createMachine();
    const frameCallbacks = new Map<number, (time: number) => void>();
    let nextFrameId = 1;

    const requestAnimationFrameSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback: (time: number) => void): number => {
        const id = nextFrameId++;
        frameCallbacks.set(id, callback);
        return id;
      });

    const cancelAnimationFrameSpy = vi
      .spyOn(window, "cancelAnimationFrame")
      .mockImplementation((id: number) => {
        frameCallbacks.delete(id);
      });

    const detach = attachJourneyDevtools(machine, { machineId: "m-coalesce", enabled: true });
    await waitForCollector(() => collector.messages.some((message) => message.kind === "register"));

    machine.updateContext(() => ({ count: 1 }));
    machine.updateContext(() => ({ count: 2 }));
    machine.updateContext(() => ({ count: 3 }));

    expect(collector.messages.filter((message) => message.kind === "snapshot")).toHaveLength(0);
    expect(frameCallbacks.size).toBe(1);

    const [scheduledFrame] = frameCallbacks.values();
    expect(scheduledFrame).toBeDefined();
    if (scheduledFrame) {
      frameCallbacks.clear();
      scheduledFrame(16);
    }

    await waitForCollector(
      () =>
        collector.messages.filter(
          (message) => message.kind === "snapshot" && message.machineId === "m-coalesce"
        ).length === 1
    );

    const snapshotEnvelope = collector.messages.find(
      (message) => message.kind === "snapshot" && message.machineId === "m-coalesce"
    );
    expect(snapshotEnvelope?.kind).toBe("snapshot");
    if (snapshotEnvelope?.kind === "snapshot") {
      expect(snapshotEnvelope.snapshot.context).toEqual({ count: 3 });
    }

    detach();
    requestAnimationFrameSpy.mockRestore();
    cancelAnimationFrameSpy.mockRestore();
    collector.stop();
  });

  it("drops pending snapshot posts when detached before frame flush", async () => {
    const collector = collectBridgeMessages();
    const { machine } = createMachine();
    const frameCallbacks = new Map<number, (time: number) => void>();
    let nextFrameId = 1;

    const requestAnimationFrameSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback: (time: number) => void): number => {
        const id = nextFrameId++;
        frameCallbacks.set(id, callback);
        return id;
      });

    const cancelAnimationFrameSpy = vi
      .spyOn(window, "cancelAnimationFrame")
      .mockImplementation((id: number) => {
        frameCallbacks.delete(id);
      });

    const detach = attachJourneyDevtools(machine, { machineId: "m-detach-pending", enabled: true });
    await waitForCollector(() => collector.messages.some((message) => message.kind === "register"));

    machine.updateContext(() => ({ count: 9 }));
    expect(frameCallbacks.size).toBe(1);
    const [staleScheduledFrame] = frameCallbacks.values();

    detach();
    expect(cancelAnimationFrameSpy).toHaveBeenCalledTimes(1);
    expect(frameCallbacks.size).toBe(0);

    // Simulate a stale frame callback invocation after detach.
    staleScheduledFrame?.(16);
    await waitForMessages();

    expect(
      collector.messages.filter(
        (message) => message.kind === "snapshot" && message.machineId === "m-detach-pending"
      )
    ).toHaveLength(0);
    expect(collector.messages[collector.messages.length - 1]?.kind).toBe("unregister");

    requestAnimationFrameSpy.mockRestore();
    cancelAnimationFrameSpy.mockRestore();
    collector.stop();
  });

  it("falls back to setTimeout coalescing when requestAnimationFrame is unavailable", async () => {
    vi.useFakeTimers();
    const collector = collectBridgeMessages();
    const { machine } = createMachine();

    const originalRequestAnimationFrame = window.requestAnimationFrame;
    const originalCancelAnimationFrame = window.cancelAnimationFrame;

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

    try {
      const detach = attachJourneyDevtools(machine, {
        machineId: "m-timeout-fallback",
        enabled: true
      });
      await vi.runAllTimersAsync();

      machine.updateContext(() => ({ count: 7 }));

      expect(collector.messages.filter((message) => message.kind === "snapshot")).toHaveLength(0);

      await vi.runAllTimersAsync();

      const snapshots = collector.messages.filter(
        (message) => message.kind === "snapshot" && message.machineId === "m-timeout-fallback"
      );
      expect(snapshots).toHaveLength(1);
      if (snapshots[0]?.kind === "snapshot") {
        expect(snapshots[0].snapshot.context).toEqual({ count: 7 });
      }

      machine.updateContext(() => ({ count: 8 }));
      detach();
      await vi.runAllTimersAsync();

      const snapshotsAfterDetach = collector.messages.filter(
        (message) => message.kind === "snapshot" && message.machineId === "m-timeout-fallback"
      );
      expect(snapshotsAfterDetach).toHaveLength(1);
    } finally {
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
      collector.stop();
      vi.useRealTimers();
    }
  });

  it("handles command envelopes with full command set", async () => {
    const collector = collectBridgeMessages();
    const { machine } = createMachine();
    const detach = attachJourneyDevtools(machine, { machineId: "m-2", enabled: true });

    await waitForMessages();

    const commands: JourneyDevtoolsExtensionEnvelope["command"][] = [
      { type: "goToNextStep" },
      { type: "goToStepById", stepId: "review" },
      { type: "goToPreviousStep", steps: 1 },
      { type: "goToLastVisitedStep" },
      { type: "send", event: { type: "custom", payload: { source: "panel" } } },
      { type: "updateStepMetadata", stepId: "review", metadata: { title: "Review updated" } },
      { type: "resetMachine" },
      { type: "clearStepError", stepId: "review" }
    ];

    for (const [index, command] of commands.entries()) {
      window.dispatchEvent(
        new MessageEvent("message", {
          source: window,
          origin: window.location.origin,
          data: buildCommandEnvelope("m-2", `req-${index}`, command)
        })
      );
      await waitForCollector(() =>
        collector.messages.some(
          (message) => message.kind === "commandResult" && message.requestId === `req-${index}`
        )
      );
    }

    const commandResults = collector.messages.filter((message) => message.kind === "commandResult");
    expect(commandResults.length).toBe(commands.length);

    const goPrevResult = commandResults.find(
      (message) => message.kind === "commandResult" && message.requestId === "req-2"
    );
    if (goPrevResult?.kind === "commandResult") {
      expect(goPrevResult.transitionId).toBe("goToPreviousStep");
      expect(goPrevResult.snapshot.currentStepId).toBe("start");
    }

    detach();
    collector.stop();
  });

  it("returns commandError for commands with unknown stepId", async () => {
    const collector = collectBridgeMessages();
    const { machine } = createMachine();
    const detach = attachJourneyDevtools(machine, {
      machineId: "m-step-validation",
      enabled: true
    });

    await waitForMessages();

    const commands: JourneyDevtoolsExtensionEnvelope["command"][] = [
      { type: "goToStepById", stepId: "missing" },
      { type: "updateStepMetadata", stepId: "missing", metadata: { title: "Nope" } },
      { type: "clearStepError", stepId: "missing" }
    ];

    for (const [index, command] of commands.entries()) {
      const requestId = `req-step-${index}`;
      window.dispatchEvent(
        new MessageEvent("message", {
          source: window,
          origin: window.location.origin,
          data: buildCommandEnvelope("m-step-validation", requestId, command)
        })
      );
      await waitForCollector(() =>
        collector.messages.some(
          (message) => message.kind === "commandError" && message.requestId === requestId
        )
      );
    }

    const errors = collector.messages.filter((message) => message.kind === "commandError");
    expect(errors).toHaveLength(commands.length);
    for (const error of errors) {
      expect(error.error.message).toContain('Unknown stepId "missing"');
    }

    detach();
    collector.stop();
  });

  it("posts command errors when command execution throws", async () => {
    const collector = collectBridgeMessages();
    const { machine } = createMachine();

    const send = vi
      .spyOn(machine, "send")
      .mockRejectedValueOnce(new Error("boom"))
      .mockImplementation(async (event) => {
        if (event.type === "goToNextStep") {
          return {
            transitioned: true,
            snapshot: createSnapshot("review", 1),
            transitionId: "goToNextStep"
          };
        }
        return { transitioned: false, snapshot: createSnapshot("start", 0) };
      });

    const detach = attachJourneyDevtools(machine, { machineId: "m-3", enabled: true });
    await waitForMessages();

    window.dispatchEvent(
      new MessageEvent("message", {
        source: window,
        origin: window.location.origin,
        data: buildCommandEnvelope("m-3", "req-fail", { type: "goToNextStep" })
      })
    );

    await waitForCollector(() =>
      collector.messages.some(
        (message) => message.kind === "commandError" && message.requestId === "req-fail"
      )
    );

    const errorEnvelope = collector.messages.find(
      (message) => message.kind === "commandError" && message.requestId === "req-fail"
    );

    expect(errorEnvelope?.kind).toBe("commandError");
    if (errorEnvelope?.kind === "commandError") {
      expect(errorEnvelope.error.message).toContain("boom");
    }

    send.mockRestore();
    detach();
    collector.stop();
  });
});
