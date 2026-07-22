import { describe, expect, it } from "vitest";
import { createLinearJourney } from "@rxova/journey-core";
import { createExecutionPathsPlugin } from "@rxova/journey-core/execution-paths";
import { flush } from "@rxova/journey-core/testing";
import type { ExecutionPathsSnapshot } from "@rxova/journey-core/execution-paths";

/**
 * completedPaths was the one plugin buffer with no bound at all: a machine that
 * completes and restarts on a loop retained one frozen array per run for the
 * lifetime of the process.
 */
async function runAndComplete(
  machine: ReturnType<typeof createLinearJourney<"a" | "b", Record<string, never>>>,
  runs: number
): Promise<void> {
  for (let i = 0; i < runs; i++) {
    if (i === 0) machine.controls.start();
    else machine.controls.restart();
    await flush();
    await machine.navigate.goToNextStep();
    machine.controls.complete();
    await flush();
  }
}

describe("execution-paths retention", () => {
  it("keeps the newest runs up to maxPaths", async () => {
    const plugin = createExecutionPathsPlugin({ maxPaths: 3 });
    const machine = createLinearJourney(
      { steps: ["a", "b"], context: {} },
      { plugins: [plugin] as const }
    );

    await runAndComplete(machine, 6);

    const paths = machine.plugins["execution-paths"].getCompletedPaths();
    expect(paths).toHaveLength(3);
    expect(paths.every((path) => path.length > 0)).toBe(true);
  });

  it("defaults to a bounded retention rather than growing forever", async () => {
    const machine = createLinearJourney(
      { steps: ["a", "b"], context: {} },
      { plugins: [createExecutionPathsPlugin()] as const }
    );

    await runAndComplete(machine, 60);

    expect(machine.plugins["execution-paths"].getCompletedPaths().length).toBeLessThanOrEqual(50);
  });

  it("clearCompletedPaths drops history without touching the current run", async () => {
    const machine = createLinearJourney(
      { steps: ["a", "b"], context: {} },
      { plugins: [createExecutionPathsPlugin()] as const }
    );

    await runAndComplete(machine, 2);
    machine.controls.restart();
    await flush();

    const api = machine.plugins["execution-paths"];
    expect(api.getCompletedPaths().length).toBeGreaterThan(0);
    const current = api.getCurrentPath();

    api.clearCompletedPaths();

    expect(api.getCompletedPaths()).toEqual([]);
    expect(api.getCurrentPath()).toEqual(current);
  });

  it("reflects the bound in the snapshot slice", async () => {
    const machine = createLinearJourney(
      { steps: ["a", "b"], context: {} },
      { plugins: [createExecutionPathsPlugin({ maxPaths: 2 })] as const }
    );

    await runAndComplete(machine, 5);

    const slice = machine.getSnapshot().plugins["execution-paths"] as ExecutionPathsSnapshot;
    expect(slice.completedPaths).toHaveLength(2);
  });
});
