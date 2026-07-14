import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildOperationRunners,
  createJourneyMachineId,
  OperationRateLimiter,
  serializeSnapshot,
  type OperationRunner
} from "@rxova/journey-devtools-bridge";
import { startedGraphMachine, startedLinearMachine } from "@rxova/journey-devtools-bridge/testing";

afterEach(() => {
  vi.useRealTimers();
});

function runnerById(runners: OperationRunner[], id: string): OperationRunner {
  const runner = runners.find((candidate) => candidate.descriptor.id === id);
  if (!runner) throw new Error(`missing runner ${id}`);
  return runner;
}

describe("createJourneyMachineId", () => {
  it("produces unique, recognisable ids", () => {
    const first = createJourneyMachineId();
    const second = createJourneyMachineId();
    expect(first).toMatch(/^journey-[a-z0-9]+-[a-z0-9]+$/);
    expect(first).not.toBe(second);
  });
});

describe("OperationRateLimiter", () => {
  it("allows up to maxPerWindow operations and recovers after the window", () => {
    vi.useFakeTimers();
    const limiter = new OperationRateLimiter(2, 1000);
    expect(limiter.isAllowed()).toBe(true);
    expect(limiter.isAllowed()).toBe(true);
    expect(limiter.isAllowed()).toBe(false);

    vi.advanceTimersByTime(1001);
    expect(limiter.isAllowed()).toBe(true);
  });
});

describe("serializeSnapshot", () => {
  it("clones the snapshot into transport-safe data", async () => {
    const machine = await startedLinearMachine();
    const snapshot = machine.getSnapshot();
    const serialized = serializeSnapshot(snapshot);

    expect(serialized).not.toBe(snapshot);
    expect(serialized).toMatchObject({ type: "linear", currentStep: { id: "a" } });
    expect(JSON.parse(JSON.stringify(serialized))).toEqual(serialized);
  });
});

describe("buildOperationRunners", () => {
  it("builds the linear operation set (no events feature)", async () => {
    const machine = await startedLinearMachine();
    const runners = buildOperationRunners(machine);
    const ids = runners.map((runner) => runner.descriptor.id);

    expect(ids).toEqual([
      "lifecycle.start",
      "lifecycle.pause",
      "lifecycle.resume",
      "lifecycle.complete",
      "lifecycle.terminate",
      "lifecycle.restart",
      "navigation.goToNextStep",
      "navigation.goToPreviousStep",
      "navigation.goToStepById",
      "navigation.goToLastVisitedStep",
      "context.patch",
      "machine.inspectSnapshot"
    ]);
    expect(runners.every((runner) => runner.descriptor.mutates)).toBe(false);
    expect(runnerById(runners, "machine.inspectSnapshot").descriptor.mutates).toBe(false);
  });

  it("adds events.send for graph machines and drives it", async () => {
    const machine = await startedGraphMachine();
    const runners = buildOperationRunners(machine);
    const send = runnerById(runners, "events.send");

    const result = await send.run({ type: "GO" });
    expect(result).toMatchObject({ kind: "snapshot", transitioned: true });
    expect(machine.getSnapshot().currentStep?.id).toBe("b");

    await expect(send.run({})).rejects.toThrow('"type" must be a non-empty string');
  });

  it("lifecycle runners report whether the verb applied", async () => {
    const machine = await startedLinearMachine();
    const runners = buildOperationRunners(machine);

    expect(await runnerById(runners, "lifecycle.pause").run(undefined)).toMatchObject({
      transitioned: true
    });
    expect(await runnerById(runners, "lifecycle.pause").run(undefined)).toMatchObject({
      transitioned: false // already paused
    });
    expect(await runnerById(runners, "lifecycle.resume").run(undefined)).toMatchObject({
      transitioned: true
    });
    expect(
      await runnerById(runners, "lifecycle.complete").run({ payload: { done: true } })
    ).toMatchObject({ transitioned: true });
    expect(machine.getSnapshot().outcome).toEqual({ type: "completed", payload: { done: true } });
    expect(await runnerById(runners, "lifecycle.restart").run(undefined)).toMatchObject({
      transitioned: true
    });
  });

  it("navigation runners validate input and surface failures", async () => {
    const machine = await startedLinearMachine();
    const runners = buildOperationRunners(machine);

    await expect(runnerById(runners, "navigation.goToStepById").run({})).rejects.toThrow(
      '"stepId" must be a non-empty string'
    );
    await expect(
      runnerById(runners, "navigation.goToPreviousStep").run({ steps: 1.5 })
    ).rejects.toThrow('"steps" must be a positive integer');

    const blocked = await runnerById(runners, "navigation.goToPreviousStep").run(undefined);
    expect(blocked).toMatchObject({ kind: "snapshot", transitioned: false });

    const moved = await runnerById(runners, "navigation.goToStepById").run({ stepId: "c" });
    expect(moved).toMatchObject({ kind: "snapshot", transitioned: true });
  });

  it("context.patch shallow-merges and rejects non-object patches", async () => {
    const machine = await startedLinearMachine();
    const runners = buildOperationRunners(machine);
    const patch = runnerById(runners, "context.patch");

    await patch.run({ patch: { extra: 1 } });
    expect(machine.getSnapshot().context).toEqual({ n: 0, extra: 1 });

    await expect(patch.run({ patch: "nope" })).rejects.toThrow('"patch" must be an object');
    await expect(patch.run({ patch: null })).rejects.toThrow('"patch" must be an object');
  });

  it("machine.inspectSnapshot returns serialized data", async () => {
    const machine = await startedLinearMachine();
    const runners = buildOperationRunners(machine);
    const result = await runnerById(runners, "machine.inspectSnapshot").run(undefined);
    expect(result).toMatchObject({ kind: "data", data: { currentStep: { id: "a" } } });
  });
});
