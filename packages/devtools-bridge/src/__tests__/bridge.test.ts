import { afterEach, describe, expect, it } from "vitest";
import { createLinearJourney } from "@rxova/journey-core";
import {
  attachJourneyDevtools,
  JOURNEY_DEVTOOLS_REPLAY_REQUEST
} from "@rxova/journey-devtools-bridge";
import {
  buildInvokeEnvelope,
  captureBridgeEnvelopes,
  flush,
  postToBridge,
  startedGraphMachine,
  startedLinearMachine
} from "@rxova/journey-devtools-bridge/testing";
import type { JourneyDevtoolsBridgeOptions } from "@rxova/journey-devtools-bridge";

const detachers: (() => void)[] = [];
const stoppers: (() => void)[] = [];

afterEach(() => {
  for (const detach of detachers.splice(0)) detach();
  for (const stop of stoppers.splice(0)) stop();
});

async function attachedLinear(options: JourneyDevtoolsBridgeOptions = {}) {
  const machine = await startedLinearMachine();
  const capture = captureBridgeEnvelopes();
  stoppers.push(capture.stop);
  const detach = attachJourneyDevtools(machine, {
    machineId: "test-machine",
    label: "Test",
    appName: "Bridge Suite",
    enabled: true,
    ...options
  });
  detachers.push(detach);
  await flush();
  return { machine, capture, detach };
}

describe("registration", () => {
  it("posts a register envelope with meta and the serialized snapshot", async () => {
    const { capture } = await attachedLinear();

    const registers = capture.ofKind("register");
    expect(registers).toHaveLength(1);
    const register = registers[0]!;
    expect(register.meta).toMatchObject({
      machineId: "test-machine",
      label: "Test",
      appName: "Bridge Suite",
      mutationsEnabled: true,
      mode: "linear",
      stepIds: ["a", "b", "c"]
    });
    expect(register.snapshot).toMatchObject({
      type: "linear",
      status: "running",
      currentStep: { id: "a" }
    });

    const featureIds = register.meta.features.map((feature) => feature.id);
    expect(featureIds).toEqual(["lifecycle", "navigation", "context", "machine"]);
  });

  it("graph machines expose the send operation and declared eventTypes", async () => {
    const machine = await startedGraphMachine();
    const capture = captureBridgeEnvelopes();
    stoppers.push(capture.stop);
    detachers.push(
      attachJourneyDevtools(machine, {
        machineId: "graph-machine",
        enabled: true,
        eventTypes: ["GO", "RESET"]
      })
    );
    await flush();

    const register = capture.ofKind("register")[0]!;
    expect(register.meta.mode).toBe("graph");
    expect(register.meta.eventTypes).toEqual(["GO", "RESET"]);
    const events = register.meta.features.find((feature) => feature.id === "events");
    expect(events?.operations.map((operation) => operation.id)).toEqual(["events.send"]);
  });

  it("does nothing when disabled", async () => {
    const machine = await startedLinearMachine();
    const capture = captureBridgeEnvelopes();
    stoppers.push(capture.stop);
    const detach = attachJourneyDevtools(machine, { enabled: false });
    await flush();
    expect(capture.envelopes).toHaveLength(0);
    expect(() => detach()).not.toThrow();
  });
});

describe("streaming", () => {
  it("streams snapshot envelopes as the machine moves", async () => {
    const { machine, capture } = await attachedLinear();
    capture.clear();

    await machine.navigate.goToNextStep();
    await flush();

    const snapshots = capture.ofKind("snapshot");
    expect(snapshots.length).toBeGreaterThan(0);
    expect(snapshots[snapshots.length - 1]?.snapshot).toMatchObject({ currentStep: { id: "b" } });
  });

  it("emits lean observation envelopes without embedded snapshots", async () => {
    const { machine, capture } = await attachedLinear();
    capture.clear();

    await machine.navigate.goToNextStep();
    machine.context.update((c) => ({ ...(c as { n: number }), n: 1 }));
    await machine.navigate.goToPreviousStep(5); // out-of-bounds later; first move ok
    await flush();

    const kinds = capture.ofKind("observation").map((envelope) => envelope.event.type);
    expect(kinds).toContain("stepLeave");
    expect(kinds).toContain("stepEnter");
    expect(kinds).toContain("contextChange");
    const stepEnter = capture
      .ofKind("observation")
      .find((envelope) => envelope.event.type === "stepEnter");
    expect(stepEnter?.event).not.toHaveProperty("snapshot");
    expect(stepEnter?.event).toMatchObject({ from: "a", to: "b" });
  });

  it("re-emits register on a replay request", async () => {
    const { capture } = await attachedLinear();
    capture.clear();

    await postToBridge({ type: JOURNEY_DEVTOOLS_REPLAY_REQUEST });
    expect(capture.ofKind("register")).toHaveLength(1);
  });
});

describe("operation invokes", () => {
  it("runs navigation operations and reports the result", async () => {
    const { machine, capture } = await attachedLinear();
    capture.clear();

    await postToBridge(
      buildInvokeEnvelope(
        "test-machine",
        "navigation.goToStepById",
        { stepId: "c" },
        { requestId: "r1" }
      )
    );

    const results = capture.ofKind("operationResult");
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      requestId: "r1",
      operationId: "navigation.goToStepById",
      result: { kind: "snapshot", transitioned: true }
    });
    expect(machine.getSnapshot().currentStep?.id).toBe("c");
  });

  it("reports failed navigations with transitioned=false and an error", async () => {
    const { capture } = await attachedLinear();
    capture.clear();

    await postToBridge(buildInvokeEnvelope("test-machine", "navigation.goToPreviousStep"));
    const result = capture.ofKind("operationResult")[0]!;
    expect(result.result).toMatchObject({ kind: "snapshot", transitioned: false });
    expect((result.result as { error?: { message: string } }).error?.message).toContain(
      "out-of-bounds"
    );
  });

  it("drives lifecycle verbs with payloads", async () => {
    const { machine, capture } = await attachedLinear();
    capture.clear();

    await postToBridge(
      buildInvokeEnvelope("test-machine", "lifecycle.complete", { payload: { score: 9 } })
    );
    expect(machine.getSnapshot().status).toBe("completed");
    expect(machine.getSnapshot().machine.outcome).toEqual({
      type: "completed",
      payload: { score: 9 }
    });
    expect(capture.ofKind("operationResult")[0]?.result).toMatchObject({ transitioned: true });
  });

  it("sends graph events with payloads", async () => {
    const machine = await startedGraphMachine();
    const capture = captureBridgeEnvelopes();
    stoppers.push(capture.stop);
    detachers.push(attachJourneyDevtools(machine, { machineId: "graph-machine", enabled: true }));
    await flush();
    capture.clear();

    await postToBridge(buildInvokeEnvelope("graph-machine", "events.send", { type: "GO" }));
    expect(machine.getSnapshot().currentStep?.id).toBe("b");
  });

  it("patches context and inspects the snapshot", async () => {
    const { machine, capture } = await attachedLinear();
    capture.clear();

    await postToBridge(buildInvokeEnvelope("test-machine", "context.patch", { patch: { n: 42 } }));
    expect(machine.getSnapshot().context).toEqual({ n: 42 });

    await postToBridge(buildInvokeEnvelope("test-machine", "machine.inspectSnapshot"));
    const inspect = capture
      .ofKind("operationResult")
      .find((envelope) => envelope.operationId === "machine.inspectSnapshot");
    expect(inspect?.result).toMatchObject({ kind: "data", data: { context: { n: 42 } } });
  });

  it("rejects unknown operations and invalid inputs with operationError", async () => {
    const { capture } = await attachedLinear();
    capture.clear();

    await postToBridge(buildInvokeEnvelope("test-machine", "navigation.warpDrive"));
    await postToBridge(buildInvokeEnvelope("test-machine", "navigation.goToStepById", {}));
    await postToBridge(buildInvokeEnvelope("test-machine", "context.patch", { patch: [1, 2] }));

    const errors = capture.ofKind("operationError");
    expect(errors).toHaveLength(3);
    expect(errors[0]?.error.message).toContain('unknown operation "navigation.warpDrive"');
    expect(errors[1]?.error.message).toContain('"stepId" must be a non-empty string');
    expect(errors[2]?.error.message).toContain('"patch" must be an object');
  });

  it("blocks mutating operations when mutations are disabled", async () => {
    const { machine, capture } = await attachedLinear({ mutationsEnabled: false });
    capture.clear();

    await postToBridge(buildInvokeEnvelope("test-machine", "navigation.goToNextStep"));
    expect(capture.ofKind("operationError")[0]?.error.message).toContain("mutations are disabled");
    expect(machine.getSnapshot().currentStep?.id).toBe("a");

    // non-mutating operations still run
    await postToBridge(buildInvokeEnvelope("test-machine", "machine.inspectSnapshot"));
    expect(capture.ofKind("operationResult")).toHaveLength(1);
  });

  it("rate limits operation invokes", async () => {
    const { capture } = await attachedLinear({ rateLimit: { maxPerWindow: 1 } });
    capture.clear();

    await postToBridge(buildInvokeEnvelope("test-machine", "machine.inspectSnapshot"));
    await postToBridge(buildInvokeEnvelope("test-machine", "machine.inspectSnapshot"));

    expect(capture.ofKind("operationResult")).toHaveLength(1);
    expect(capture.ofKind("operationError")[0]?.error.message).toContain("rate limit");
  });

  it("ignores invokes for other machines and incompatible protocol versions", async () => {
    const { capture } = await attachedLinear();
    capture.clear();

    await postToBridge(buildInvokeEnvelope("someone-else", "machine.inspectSnapshot"));
    await postToBridge(
      buildInvokeEnvelope("test-machine", "machine.inspectSnapshot", undefined, { version: 5 })
    );
    await postToBridge({
      ...buildInvokeEnvelope("test-machine", "machine.inspectSnapshot"),
      kind: "unregister"
    });

    expect(capture.ofKind("operationResult")).toHaveLength(0);
    expect(capture.ofKind("operationError")).toHaveLength(0);
  });
});

describe("detach", () => {
  it("posts unregister, stops streaming, and is idempotent", async () => {
    const { machine, capture, detach } = await attachedLinear();
    capture.clear();

    detach();
    await flush();
    expect(capture.ofKind("unregister")).toHaveLength(1);

    capture.clear();
    await machine.navigate.goToNextStep();
    await postToBridge(buildInvokeEnvelope("test-machine", "machine.inspectSnapshot"));
    expect(capture.envelopes).toHaveLength(0);

    expect(() => detach()).not.toThrow();
  });
});

describe("remaining operations", () => {
  it("drives pause, resume, terminate, and restart", async () => {
    const { machine, capture } = await attachedLinear();
    capture.clear();

    await postToBridge(buildInvokeEnvelope("test-machine", "lifecycle.pause"));
    expect(machine.getSnapshot().status).toBe("paused");
    await postToBridge(buildInvokeEnvelope("test-machine", "lifecycle.resume"));
    expect(machine.getSnapshot().status).toBe("running");
    await postToBridge(
      buildInvokeEnvelope("test-machine", "lifecycle.terminate", { payload: "why" })
    );
    expect(machine.getSnapshot().machine.outcome).toEqual({ type: "terminated", payload: "why" });
    await postToBridge(buildInvokeEnvelope("test-machine", "lifecycle.restart"));
    expect(machine.getSnapshot().status).toBe("running");

    expect(capture.ofKind("operationResult")).toHaveLength(4);
  });

  it("reports rejected lifecycle verbs as transitioned=false", async () => {
    const { capture } = await attachedLinear();
    capture.clear();

    await postToBridge(buildInvokeEnvelope("test-machine", "lifecycle.start")); // already running
    expect(capture.ofKind("operationResult")[0]?.result).toMatchObject({
      kind: "snapshot",
      transitioned: false
    });
  });

  it("walks the timeline with goToPreviousStep(steps) and goToLastVisitedStep", async () => {
    const { machine, capture } = await attachedLinear();
    await machine.navigate.goToNextStep();
    await machine.navigate.goToNextStep();
    capture.clear();

    await postToBridge(
      buildInvokeEnvelope("test-machine", "navigation.goToPreviousStep", { steps: 2 })
    );
    expect(machine.getSnapshot().currentStep?.id).toBe("a");

    await postToBridge(buildInvokeEnvelope("test-machine", "navigation.goToLastVisitedStep"));
    expect(machine.getSnapshot().currentStep?.id).toBe("c");

    await postToBridge(
      buildInvokeEnvelope("test-machine", "navigation.goToPreviousStep", { steps: 0 })
    );
    expect(capture.ofKind("operationError")[0]?.error.message).toContain("positive integer");
  });

  it("generates a machine id when none is provided", async () => {
    const machine = await startedLinearMachine();
    const capture = captureBridgeEnvelopes();
    stoppers.push(capture.stop);
    detachers.push(attachJourneyDevtools(machine, { enabled: true }));
    await flush();

    expect(capture.ofKind("register")[0]?.machineId).toMatch(/^journey-/);
  });
});

describe("lifecycle effect errors", () => {
  it("keeps a thrown onLeave error on the committed destination snapshot", async () => {
    const machine = createLinearJourney({
      steps: [
        {
          id: "a",
          onLeave: () => {
            throw new Error("no leaving");
          }
        },
        "b"
      ],
      context: {}
    });
    machine.controls.start();
    await flush();
    const capture = captureBridgeEnvelopes();
    stoppers.push(capture.stop);
    detachers.push(attachJourneyDevtools(machine, { machineId: "hooked", enabled: true }));
    await flush();
    capture.clear();

    await postToBridge(buildInvokeEnvelope("hooked", "navigation.goToNextStep"));
    const result = capture.ofKind("operationResult")[0]!;
    expect(result.result).toMatchObject({
      kind: "snapshot",
      transitioned: true,
      snapshot: {
        currentStep: { id: "b", async: { isError: true, error: { message: "no leaving" } } }
      }
    });
  });
});
