import { afterEach, describe, expect, it } from "vitest";

import {
  attachJourneyDevtools,
  type JourneyDevtoolsBridgeEnvelope
} from "@rxova/journey-devtools-bridge";

import {
  buildCommandEnvelope,
  collectBridgeMessages,
  createTestMachine,
  createTestSnapshot,
  waitForCollector,
  waitForMessages
} from "./helpers";

describe("attachJourneyDevtools", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it("registers, emits snapshots, and unregisters", async () => {
    const collector = collectBridgeMessages();
    const machine = createTestMachine();

    const detach = attachJourneyDevtools(machine, {
      machineId: "m-1",
      label: "Checkout",
      enabled: true
    });

    await waitForMessages();

    const register = collector.messages[0];
    expect(register?.kind).toBe("register");
    if (register?.kind === "register") {
      expect(register.snapshot.currentStepId).toBe("start");
      expect(register.meta.machineId).toBe("m-1");
      expect(register.meta.label).toBe("Checkout");
    }

    await machine.updateContext((context) => ({
      ...context,
      count: context.count + 1
    }));

    await waitForCollector(() =>
      collector.messages.some(
        (message) =>
          message.kind === "snapshot" &&
          message.machineId === "m-1" &&
          message.snapshot.context.count === 1
      )
    );

    detach();
    await waitForMessages();

    expect(collector.messages[collector.messages.length - 1]?.kind).toBe("unregister");
    collector.stop();
  });

  it("emits observations and answers execution-path queries", async () => {
    const collector = collectBridgeMessages();
    const machine = createTestMachine({
      executionPaths: {
        paths: [
          {
            steps: ["start", "review"],
            events: ["goToNextStep"],
            terminated: "final"
          }
        ],
        truncated: false,
        cyclesDetected: false
      }
    });

    const detach = attachJourneyDevtools(machine, {
      machineId: "m-2",
      enabled: true
    });

    await waitForMessages();

    machine.emitObservation({
      type: "journey.start",
      stepId: "start",
      timestamp: Date.now()
    });

    await waitForCollector(() =>
      collector.messages.some(
        (message) => message.kind === "observation" && message.machineId === "m-2"
      )
    );

    window.dispatchEvent(buildCommandEnvelope("m-2", "req-paths", { type: "getExecutionPaths" }));

    await waitForCollector(() =>
      collector.messages.some(
        (message) => message.kind === "executionPathsResult" && message.requestId === "req-paths"
      )
    );

    const observation = collector.messages.find((message) => message.kind === "observation") as
      | JourneyDevtoolsBridgeEnvelope
      | undefined;
    const result = collector.messages.find(
      (message) => message.kind === "executionPathsResult" && message.requestId === "req-paths"
    );

    expect(observation?.kind).toBe("observation");
    if (observation?.kind === "observation") {
      expect(observation.event.type).toBe("journey.start");
    }

    expect(result?.kind).toBe("executionPathsResult");
    if (result?.kind === "executionPathsResult") {
      expect(result.result.paths).toEqual([
        {
          steps: ["start", "review"],
          events: ["goToNextStep"],
          terminated: "final"
        }
      ]);
    }

    detach();
    collector.stop();
  });

  it("runs mutating commands against the machine", async () => {
    const collector = collectBridgeMessages();
    const machine = createTestMachine();

    const detach = attachJourneyDevtools(machine, {
      machineId: "m-3",
      enabled: true
    });

    await waitForMessages();

    const commands = [
      buildCommandEnvelope("m-3", "req-next", { type: "goToNextStep" }),
      buildCommandEnvelope("m-3", "req-send", {
        type: "send",
        event: { type: "custom", payload: { amount: 2 } }
      }),
      buildCommandEnvelope("m-3", "req-reset", { type: "resetJourney" })
    ];

    for (const command of commands) {
      window.dispatchEvent(command);
    }

    await waitForCollector(
      () => collector.messages.filter((message) => message.kind === "commandResult").length >= 3
    );

    const nextResult = collector.messages.find(
      (message) => message.kind === "commandResult" && message.requestId === "req-next"
    );
    const sendResult = collector.messages.find(
      (message) => message.kind === "commandResult" && message.requestId === "req-send"
    );
    const resetResult = collector.messages.find(
      (message) => message.kind === "commandResult" && message.requestId === "req-reset"
    );

    expect(nextResult?.kind).toBe("commandResult");
    if (nextResult?.kind === "commandResult") {
      expect(nextResult.snapshot.currentStepId).toBe("review");
      expect(nextResult.transitionId).toBe("goToNextStep");
    }

    expect(sendResult?.kind).toBe("commandResult");
    if (sendResult?.kind === "commandResult") {
      expect(sendResult.snapshot.context.count).toBe(3);
      expect(sendResult.transitionId).toBe("custom");
    }

    expect(resetResult?.kind).toBe("commandResult");
    if (resetResult?.kind === "commandResult") {
      expect(resetResult.snapshot.currentStepId).toBe("start");
    }

    detach();
    collector.stop();
  });

  it("returns command errors for unknown step ids", async () => {
    const collector = collectBridgeMessages();
    const machine = createTestMachine({
      initialSnapshot: createTestSnapshot("review", 1)
    });

    const detach = attachJourneyDevtools(machine, {
      machineId: "m-4",
      enabled: true
    });

    await waitForMessages();

    window.dispatchEvent(
      buildCommandEnvelope("m-4", "req-bad-step", {
        type: "goToStepById",
        stepId: "missing"
      } as never)
    );

    await waitForCollector(() =>
      collector.messages.some(
        (message) => message.kind === "commandError" && message.requestId === "req-bad-step"
      )
    );

    const error = collector.messages.find(
      (message) => message.kind === "commandError" && message.requestId === "req-bad-step"
    );
    expect(error?.kind).toBe("commandError");
    if (error?.kind === "commandError") {
      expect(error.error.message).toContain('Unknown stepId "missing"');
    }

    detach();
    collector.stop();
  });
});
