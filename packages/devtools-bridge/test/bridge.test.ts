import { afterEach, describe, expect, it } from "vitest";

import type { JourneyMachine } from "@rxova/journey-core";
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
type Event = "next" | "back" | "close" | "submit" | "custom";
type Context = { count: number };

const createSnapshot = (current: StepId = "start") => ({
  current,
  context: { count: current === "start" ? 0 : 1 },
  history: current === "start" ? [] : (["start"] as StepId[]),
  visited: current === "start" ? (["start"] as StepId[]) : (["start", "review"] as StepId[]),
  status: "running" as const,
  async: {
    isLoading: false,
    byStep: {
      start: { phase: "idle" as const, eventType: null, transitionId: null, error: null },
      review: { phase: "idle" as const, eventType: null, transitionId: null, error: null }
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

const createMachine = () => {
  let snapshot = createSnapshot();
  const listeners = new Set<() => void>();
  let rejectNext = false;

  const machine: JourneyMachine<Context, StepId, Event> = {
    getSnapshot: () => snapshot,
    send: async (event) => {
      if (rejectNext) {
        rejectNext = false;
        throw new Error("send failed");
      }

      if (event.type === "next") {
        snapshot = createSnapshot("review");
      }
      if (event.type === "goTo") {
        snapshot = createSnapshot(event.to === "review" ? "review" : "start");
      }
      listeners.forEach((listener) => {
        listener();
      });
      return {
        transitioned: true,
        snapshot,
        transitionId: event.type
      };
    },
    updateContext: (updater) => {
      snapshot = { ...snapshot, context: updater(snapshot.context) };
      listeners.forEach((listener) => {
        listener();
      });
      return snapshot;
    },
    clearStepError: () => snapshot,
    reset: () => {
      snapshot = createSnapshot("start");
      listeners.forEach((listener) => {
        listener();
      });
      return snapshot;
    },
    trimHistory: () => snapshot,
    clearHistory: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    }
  };

  return {
    machine,
    triggerChange: () => {
      listeners.forEach((listener) => {
        listener();
      });
    },
    rejectNextSend: () => {
      rejectNext = true;
    }
  };
};

describe("attachJourneyDevtools", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it("registers machine and posts initial snapshot", async () => {
    const collector = collectBridgeMessages();
    const { machine } = createMachine();

    const detach = attachJourneyDevtools(machine, { machineId: "m-1", label: "Checkout" });
    await waitForMessages();

    expect(collector.messages[0]?.kind).toBe("register");
    expect(collector.messages[0]?.source).toBe(JOURNEY_DEVTOOLS_BRIDGE_SOURCE);
    if (collector.messages[0]?.kind === "register") {
      expect(collector.messages[0].meta.machineId).toBe("m-1");
      expect(collector.messages[0].meta.label).toBe("Checkout");
      expect(collector.messages[0].meta.commandsEnabled).toBe(true);
      expect(collector.messages[0].snapshot.current).toBe("start");
    }

    detach();
    collector.stop();
  });

  it("posts snapshot updates when machine subscriptions emit", async () => {
    const collector = collectBridgeMessages();
    const { machine, triggerChange } = createMachine();

    const detach = attachJourneyDevtools(machine, { machineId: "m-2" });
    await waitForMessages();

    triggerChange();
    await waitForMessages();

    expect(collector.messages.some((message) => message.kind === "snapshot")).toBe(true);

    detach();
    collector.stop();
  });

  it("executes commands and posts command results and errors", async () => {
    const collector = collectBridgeMessages();
    const { machine, rejectNextSend } = createMachine();

    const detach = attachJourneyDevtools(machine, { machineId: "m-3" });
    await waitForMessages();

    const nextCommand = buildCommandEnvelope("m-3", "req-1", { type: "next" });
    window.dispatchEvent(
      new MessageEvent("message", {
        source: window,
        origin: window.location.origin,
        data: nextCommand
      })
    );
    await waitForMessages();

    const goToCommand = buildCommandEnvelope("m-3", "req-2", { type: "goTo", to: "review" });
    window.dispatchEvent(
      new MessageEvent("message", {
        source: window,
        origin: window.location.origin,
        data: goToCommand
      })
    );
    await waitForMessages();

    const sendCommand = buildCommandEnvelope("m-3", "req-3", {
      type: "send",
      event: { type: "custom", payload: { from: "panel" } }
    });
    window.dispatchEvent(
      new MessageEvent("message", {
        source: window,
        origin: window.location.origin,
        data: sendCommand
      })
    );
    await waitForMessages();

    rejectNextSend();
    const failingCommand = buildCommandEnvelope("m-3", "req-4", { type: "next" });
    window.dispatchEvent(
      new MessageEvent("message", {
        source: window,
        origin: window.location.origin,
        data: failingCommand
      })
    );
    await waitForMessages();

    const recoveryCommand = buildCommandEnvelope("m-3", "req-5", { type: "next" });
    window.dispatchEvent(
      new MessageEvent("message", {
        source: window,
        origin: window.location.origin,
        data: recoveryCommand
      })
    );
    await waitForMessages();
    await waitForMessages();

    const resultIds = collector.messages
      .filter(
        (message): message is Extract<JourneyDevtoolsBridgeEnvelope, { kind: "commandResult" }> =>
          message.kind === "commandResult"
      )
      .map((message) => message.requestId);
    const errorIds = collector.messages
      .filter(
        (message): message is Extract<JourneyDevtoolsBridgeEnvelope, { kind: "commandError" }> =>
          message.kind === "commandError"
      )
      .map((message) => message.requestId);

    expect(resultIds).toEqual(expect.arrayContaining(["req-1", "req-2", "req-3"]));
    expect(errorIds).toEqual(expect.arrayContaining(["req-4"]));
    expect([...resultIds, ...errorIds]).toContain("req-5");

    detach();
    collector.stop();
  });

  it("ignores commands for unknown machine ids", async () => {
    const collector = collectBridgeMessages();
    const { machine } = createMachine();

    const detach = attachJourneyDevtools(machine, { machineId: "m-4" });
    await waitForMessages();

    const foreignCommand = buildCommandEnvelope("other-machine", "req-x", { type: "next" });
    window.dispatchEvent(
      new MessageEvent("message", {
        source: window,
        origin: window.location.origin,
        data: foreignCommand
      })
    );
    await waitForMessages();

    const hasForeignResult = collector.messages.some(
      (message) =>
        (message.kind === "commandResult" || message.kind === "commandError") &&
        message.machineId === "other-machine"
    );

    expect(hasForeignResult).toBe(false);

    detach();
    collector.stop();
  });

  it("ignores command messages from unexpected origins", async () => {
    const collector = collectBridgeMessages();
    const { machine } = createMachine();

    const detach = attachJourneyDevtools(machine, { machineId: "m-origin" });
    await waitForMessages();

    const foreignOriginCommand = buildCommandEnvelope("m-origin", "req-origin", { type: "next" });
    window.dispatchEvent(
      new MessageEvent("message", {
        source: window,
        origin: "https://evil.example",
        data: foreignOriginCommand
      })
    );
    window.dispatchEvent(
      new MessageEvent("message", {
        source: window,
        origin: "",
        data: foreignOriginCommand
      })
    );
    await waitForMessages();

    const foreignOriginResult = collector.messages.find(
      (message) =>
        (message.kind === "commandResult" || message.kind === "commandError") &&
        "requestId" in message &&
        message.requestId === "req-origin"
    );
    expect(foreignOriginResult).toBeUndefined();

    detach();
    collector.stop();
  });

  it("rejects commands when commandsEnabled is false", async () => {
    const collector = collectBridgeMessages();
    const { machine } = createMachine();

    const detach = attachJourneyDevtools(machine, {
      machineId: "m-commands-off",
      commandsEnabled: false
    });
    await waitForMessages();

    const command = buildCommandEnvelope("m-commands-off", "req-disabled", { type: "next" });
    window.dispatchEvent(
      new MessageEvent("message", {
        source: window,
        origin: window.location.origin,
        data: command
      })
    );
    await waitForMessages();
    await waitForMessages();

    const error = collector.messages.find(
      (message): message is Extract<JourneyDevtoolsBridgeEnvelope, { kind: "commandError" }> =>
        message.kind === "commandError" && message.requestId === "req-disabled"
    );
    expect(error?.error.message).toBe("Bridge commands are disabled by configuration.");

    detach();
    collector.stop();
  });

  it("defaults to disabled in production mode", async () => {
    process.env.NODE_ENV = "production";

    const collector = collectBridgeMessages();
    const { machine } = createMachine();

    const detach = attachJourneyDevtools(machine, { machineId: "m-5" });
    await waitForMessages();

    const emittedForMachine = collector.messages.filter((message) => message.machineId === "m-5");
    expect(emittedForMachine).toHaveLength(0);

    detach();
    collector.stop();
  });

  it("defaults to disabled when NODE_ENV is unavailable", async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    delete process.env.NODE_ENV;

    const collector = collectBridgeMessages();
    const { machine } = createMachine();

    const detach = attachJourneyDevtools(machine, { machineId: "m-no-env" });
    await waitForMessages();

    const emittedForMachine = collector.messages.filter(
      (message) => message.machineId === "m-no-env"
    );
    expect(emittedForMachine).toHaveLength(0);

    detach();
    collector.stop();
    process.env.NODE_ENV = previousNodeEnv;
  });

  it("defaults commands to disabled in production unless explicitly enabled", async () => {
    process.env.NODE_ENV = "production";

    const collector = collectBridgeMessages();
    const { machine } = createMachine();

    const detach = attachJourneyDevtools(machine, { machineId: "m-prod", enabled: true });
    await waitForMessages();

    const command = buildCommandEnvelope("m-prod", "req-prod", { type: "next" });
    window.dispatchEvent(
      new MessageEvent("message", {
        source: window,
        origin: window.location.origin,
        data: command
      })
    );
    await waitForMessages();

    const commandError = collector.messages.find(
      (message): message is Extract<JourneyDevtoolsBridgeEnvelope, { kind: "commandError" }> =>
        message.kind === "commandError" && message.requestId === "req-prod"
    );
    const commandResult = collector.messages.find(
      (message): message is Extract<JourneyDevtoolsBridgeEnvelope, { kind: "commandResult" }> =>
        message.kind === "commandResult" && message.requestId === "req-prod"
    );

    expect(commandError?.error.message).toBe("Bridge commands are disabled by configuration.");
    expect(commandResult).toBeUndefined();

    detach();
    collector.stop();
  });

  it("allows commands in production when commandsEnabled is explicitly true", async () => {
    process.env.NODE_ENV = "production";

    const collector = collectBridgeMessages();
    const { machine } = createMachine();

    const detach = attachJourneyDevtools(machine, {
      machineId: "m-prod-override",
      enabled: true,
      commandsEnabled: true
    });
    await waitForMessages();

    const command = buildCommandEnvelope("m-prod-override", "req-prod-allow", { type: "next" });
    window.dispatchEvent(
      new MessageEvent("message", {
        source: window,
        origin: window.location.origin,
        data: command
      })
    );
    await waitForMessages();
    await waitForMessages();

    const commandResult = collector.messages.find(
      (message): message is Extract<JourneyDevtoolsBridgeEnvelope, { kind: "commandResult" }> =>
        message.kind === "commandResult" && message.requestId === "req-prod-allow"
    );

    expect(commandResult).toBeDefined();

    detach();
    collector.stop();
  });

  it("detaches and posts unregister while removing listeners", async () => {
    const collector = collectBridgeMessages();
    const { machine } = createMachine();

    const detach = attachJourneyDevtools(machine, { machineId: "m-6" });
    await waitForMessages();

    detach();
    await waitForMessages();

    const unregisterMessages = collector.messages.filter(
      (message) => message.kind === "unregister" && message.machineId === "m-6"
    );
    expect(unregisterMessages).toHaveLength(1);

    const commandAfterDetach = buildCommandEnvelope("m-6", "req-detach", { type: "next" });
    window.dispatchEvent(
      new MessageEvent("message", {
        source: window,
        origin: window.location.origin,
        data: commandAfterDetach
      })
    );
    await waitForMessages();

    const postDetachCommandMessage = collector.messages.find(
      (message) =>
        (message.kind === "commandResult" || message.kind === "commandError") &&
        "requestId" in message &&
        message.requestId === "req-detach"
    );
    expect(postDetachCommandMessage).toBeUndefined();

    collector.stop();
  });
});
