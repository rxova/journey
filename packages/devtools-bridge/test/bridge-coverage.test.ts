import { describe, expect, it } from "vitest";

import { attachJourneyDevtools } from "@rxova/journey-devtools-bridge";

import {
  buildCommandEnvelope,
  collectBridgeMessages,
  createTestMachine,
  waitForCollector,
  waitForMessages
} from "./helpers";

describe("bridge coverage", () => {
  it("ignores commands for a different machine id", async () => {
    const collector = collectBridgeMessages();
    const machine = createTestMachine();

    const detach = attachJourneyDevtools(machine, {
      machineId: "machine-a",
      enabled: true
    });

    await waitForMessages();

    window.dispatchEvent(buildCommandEnvelope("machine-b", "req-x", { type: "goToNextStep" }));
    await waitForMessages();

    expect(
      collector.messages.filter(
        (message) => message.kind === "commandResult" || message.kind === "commandError"
      )
    ).toHaveLength(0);

    detach();
    collector.stop();
  });

  it("returns commandError when mutating commands are disabled", async () => {
    const collector = collectBridgeMessages();
    const machine = createTestMachine();

    const detach = attachJourneyDevtools(machine, {
      machineId: "machine-c",
      enabled: true,
      commandsEnabled: false
    });

    await waitForMessages();

    window.dispatchEvent(
      buildCommandEnvelope("machine-c", "req-disabled", { type: "goToNextStep" })
    );

    await waitForCollector(() =>
      collector.messages.some(
        (message) => message.kind === "commandError" && message.requestId === "req-disabled"
      )
    );

    const error = collector.messages.find(
      (message) => message.kind === "commandError" && message.requestId === "req-disabled"
    );

    expect(error?.kind).toBe("commandError");
    if (error?.kind === "commandError") {
      expect(error.error.message).toContain("disabled");
    }

    detach();
    collector.stop();
  });

  it("still allows read-only execution path queries when commands are disabled", async () => {
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
      machineId: "machine-d",
      enabled: true,
      commandsEnabled: false
    });

    await waitForMessages();

    window.dispatchEvent(
      buildCommandEnvelope("machine-d", "req-paths", { type: "getExecutionPaths" })
    );

    await waitForCollector(() =>
      collector.messages.some(
        (message) => message.kind === "executionPathsResult" && message.requestId === "req-paths"
      )
    );

    const result = collector.messages.find(
      (message) => message.kind === "executionPathsResult" && message.requestId === "req-paths"
    );
    expect(result?.kind).toBe("executionPathsResult");

    detach();
    collector.stop();
  });
});
