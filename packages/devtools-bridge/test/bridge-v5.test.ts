import { describe, expect, it } from "vitest";

import { attachJourneyDevtools } from "@rxova/journey-devtools-bridge";

import {
  buildInvokeEnvelope,
  collectBridgeMessages,
  createTestMachine,
  waitForCollector,
  waitForMessages
} from "./helpers";

describe("attachJourneyDevtools v5", () => {
  it("registers generic features, handles invokes, and unregisters", async () => {
    const collector = collectBridgeMessages();
    const machine = await createTestMachine();

    const detach = attachJourneyDevtools(machine, {
      machineId: "m-1",
      label: "Checkout",
      enabled: true
    });

    await waitForCollector(() =>
      collector.messages.some(
        (message) => message.kind === "register" && message.machineId === "m-1"
      )
    );

    const register = collector.messages.find(
      (message) => message.kind === "register" && message.machineId === "m-1"
    );

    expect(register?.kind).toBe("register");
    if (register?.kind === "register") {
      expect(register.meta.label).toBe("Checkout");
      expect(register.meta.features.map((feature) => feature.id)).toEqual([
        "core",
        "execution-paths"
      ]);
    }

    window.dispatchEvent(
      buildInvokeEnvelope("m-1", "req-paths", {
        operationId: "execution-paths.inspect",
        input: { maxDepth: 3, maxPaths: 10 }
      })
    );
    window.dispatchEvent(
      buildInvokeEnvelope("m-1", "req-next", {
        operationId: "core.goToNextStep"
      })
    );

    await waitForCollector(
      () =>
        collector.messages.some(
          (message) => message.kind === "operationResult" && message.requestId === "req-paths"
        ) &&
        collector.messages.some(
          (message) => message.kind === "operationResult" && message.requestId === "req-next"
        )
    );

    const pathsResult = collector.messages.find(
      (message) => message.kind === "operationResult" && message.requestId === "req-paths"
    );
    expect(pathsResult?.kind).toBe("operationResult");
    if (pathsResult?.kind === "operationResult") {
      expect(pathsResult.operationId).toBe("execution-paths.inspect");
      expect(pathsResult.result.kind).toBe("data");
    }

    const nextResult = collector.messages.find(
      (message) => message.kind === "operationResult" && message.requestId === "req-next"
    );
    expect(nextResult?.kind).toBe("operationResult");
    if (nextResult?.kind === "operationResult" && nextResult.result.kind === "snapshot") {
      expect(nextResult.operationId).toBe("core.goToNextStep");
      expect(nextResult.result.snapshot.currentStepId).toBe("review");
      expect(nextResult.result.transitionId).toEqual(expect.any(String));
    }

    detach();
    await waitForMessages();

    expect(collector.messages.at(-1)?.kind).toBe("unregister");
    collector.stop();
  });

  it("blocks mutating operations when disabled but allows queries", async () => {
    const collector = collectBridgeMessages();
    const machine = await createTestMachine();

    const detach = attachJourneyDevtools(machine, {
      machineId: "m-2",
      enabled: true,
      commandsEnabled: false
    });

    await waitForCollector(() =>
      collector.messages.some(
        (message) => message.kind === "register" && message.machineId === "m-2"
      )
    );

    window.dispatchEvent(
      buildInvokeEnvelope("m-2", "req-disabled", {
        operationId: "core.goToNextStep"
      })
    );
    window.dispatchEvent(
      buildInvokeEnvelope("m-2", "req-query", {
        operationId: "execution-paths.inspect"
      })
    );

    await waitForCollector(
      () =>
        collector.messages.some(
          (message) => message.kind === "operationError" && message.requestId === "req-disabled"
        ) &&
        collector.messages.some(
          (message) => message.kind === "operationResult" && message.requestId === "req-query"
        )
    );

    const disabledError = collector.messages.find(
      (message) => message.kind === "operationError" && message.requestId === "req-disabled"
    );
    expect(disabledError?.kind).toBe("operationError");
    if (disabledError?.kind === "operationError") {
      expect(disabledError.error.message).toContain("disabled");
    }

    const queryResult = collector.messages.find(
      (message) => message.kind === "operationResult" && message.requestId === "req-query"
    );
    expect(queryResult?.kind).toBe("operationResult");
    if (queryResult?.kind === "operationResult") {
      expect(queryResult.operationId).toBe("execution-paths.inspect");
      expect(queryResult.result.kind).toBe("data");
    }

    detach();
    collector.stop();
  });
});
