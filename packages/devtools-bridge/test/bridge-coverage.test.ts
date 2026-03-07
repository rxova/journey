import { describe, expect, it } from "vitest";

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
type Event = "goToNextStep" | "custom";
type Context = { count: number };

type Snapshot = JourneySnapshot<Context, StepId>;

const createSnapshot = (current: StepId = "start"): Snapshot => ({
  currentStepId: current,
  history: {
    timeline: current === "start" ? ["start"] : ["start", "review"],
    index: current === "start" ? 0 : 1
  },
  context: { count: current === "start" ? 0 : 1 },
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

const createMachine = (): JourneyMachine<Context, StepId, Event> => {
  let snapshot = createSnapshot();
  const listeners = new Set<() => void>();

  return {
    getSnapshot: () => snapshot,
    send: async (event) => {
      if (event.type === "goToNextStep") {
        snapshot = createSnapshot("review");
      }
      listeners.forEach((listener) => listener());
      return { transitioned: true, snapshot, transitionId: event.type };
    },
    goToNextStep: async () => {
      snapshot = createSnapshot("review");
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
    goToPreviousStep: async () => ({ transitioned: false, snapshot }),
    goToLastVisitedStep: async () => ({ transitioned: false, snapshot }),
    updateContext: () => snapshot,
    updateStepMetadata: () => snapshot,
    clearStepError: () => snapshot,
    resetMachine: () => {
      snapshot = createSnapshot("start");
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
    subscribeComplete: () => () => undefined,
    subscribeTerminate: () => () => undefined
  };
};

describe("bridge coverage", () => {
  it("ignores commands for a different machine id", async () => {
    const collector = collectBridgeMessages();
    const machine = createMachine();

    const detach = attachJourneyDevtools(machine, {
      machineId: "machine-a",
      enabled: true
    });

    await waitForMessages();

    window.dispatchEvent(
      new MessageEvent("message", {
        source: window,
        origin: window.location.origin,
        data: buildCommandEnvelope("machine-b", "req-x", { type: "goToNextStep" })
      })
    );

    await waitForMessages();

    const commandRelated = collector.messages.filter(
      (message) => message.kind === "commandResult" || message.kind === "commandError"
    );
    expect(commandRelated).toHaveLength(0);

    detach();
    collector.stop();
  });

  it("returns commandError when bridge commands are disabled", async () => {
    const collector = collectBridgeMessages();
    const machine = createMachine();

    const detach = attachJourneyDevtools(machine, {
      machineId: "machine-c",
      enabled: true,
      commandsEnabled: false
    });

    await waitForMessages();

    window.dispatchEvent(
      new MessageEvent("message", {
        source: window,
        origin: window.location.origin,
        data: buildCommandEnvelope("machine-c", "req-disabled", { type: "goToNextStep" })
      })
    );

    await waitForMessages();

    const errorEnvelope = collector.messages.find(
      (message) => message.kind === "commandError" && message.requestId === "req-disabled"
    );

    expect(errorEnvelope?.kind).toBe("commandError");
    if (errorEnvelope?.kind === "commandError") {
      expect(errorEnvelope.error.message).toContain("disabled");
    }

    detach();
    collector.stop();
  });

  it("handles reset and clearStepError commands", async () => {
    const collector = collectBridgeMessages();
    const machine = createMachine();

    const detach = attachJourneyDevtools(machine, {
      machineId: "machine-d",
      enabled: true
    });

    await waitForMessages();

    const commands: JourneyDevtoolsExtensionEnvelope["command"][] = [
      { type: "clearStepError", stepId: "review" },
      { type: "resetMachine" }
    ];

    for (const [index, command] of commands.entries()) {
      window.dispatchEvent(
        new MessageEvent("message", {
          source: window,
          origin: window.location.origin,
          data: buildCommandEnvelope("machine-d", `req-${index}`, command)
        })
      );
      await waitForCollector(() =>
        collector.messages.some(
          (message) => message.kind === "commandResult" && message.requestId === `req-${index}`
        )
      );
    }

    const results = collector.messages.filter((message) => message.kind === "commandResult");
    expect(results).toHaveLength(2);

    const reset = results.find(
      (message) => message.kind === "commandResult" && message.requestId === "req-1"
    );
    if (reset?.kind === "commandResult") {
      expect(reset.snapshot.currentStepId).toBe("start");
      expect(reset.snapshot.history.timeline).toEqual(["start"]);
      expect(reset.snapshot.history.index).toBe(0);
    }

    detach();
    collector.stop();
  });
});
