import { describe, expect, it } from "vitest";
import { createLinearJourney } from "@rxova/journey-core";
import { createExecutionPathsPlugin } from "@rxova/journey-core/execution-paths";
import { flush } from "@rxova/journey-core/testing";

describe("execution-paths plugin", () => {
  it("tracks the committed step sequence of the current run", async () => {
    const plugin = createExecutionPathsPlugin();
    const machine = createLinearJourney(
      { steps: ["a", "b", "c"], context: {} },
      { plugins: [plugin] as const }
    );
    machine.controls.start();
    await flush();
    await machine.navigate.goToNextStep();
    await machine.navigate.goToNextStep();
    await machine.navigate.goToPreviousStep(2);

    expect(machine.plugins["execution-paths"].getCurrentPath()).toEqual(["a", "b", "c", "a"]);
    const extension = machine.getSnapshot().plugins["execution-paths"];
    expect(extension).toMatchObject({ currentPath: ["a", "b", "c", "a"], completedPaths: [] });
  });

  it("closes the path on completion and starts fresh after restart", async () => {
    const plugin = createExecutionPathsPlugin();
    const machine = createLinearJourney(
      { steps: ["a", "b"], context: {} },
      { plugins: [plugin] as const }
    );
    machine.controls.start();
    await flush();
    await machine.navigate.goToNextStep();
    machine.controls.complete();

    const api = machine.plugins["execution-paths"];
    expect(api.getCompletedPaths()).toEqual([["a", "b"]]);
    expect(api.getCurrentPath()).toEqual([]);

    machine.controls.restart();
    await flush();
    expect(api.getCurrentPath()).toEqual(["a"]);
  });
});
