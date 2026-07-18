import { describe, expect, it } from "vitest";
import { createGraphJourney, createLinearJourney } from "@rxova/journey-core";
import { flush, startedLinear } from "@rxova/journey-core/testing";
import type { StepEnterDirection } from "@rxova/journey-core";

type Entry = { from: string | null; to: string; direction: StepEnterDirection };

describe("stepEnter direction", () => {
  it("reports intent per verb: jump on entry and absolute moves, forward/backward on relative ones", async () => {
    const entries: Entry[] = [];
    const machine = await startedLinear();
    machine.subscriptions.subscribeEvent("stepEnter", ({ from, to, direction }) => {
      entries.push({ from, to, direction });
    });

    await machine.navigate.goToNextStep(); // append at tip
    await machine.navigate.goToPreviousStep(); // pointer back
    await machine.navigate.goToNextStep(); // pointer forward
    await machine.navigate.goToStepById("d"); // absolute
    await machine.navigate.goToPreviousStep();
    await machine.navigate.goToLastVisitedStep(); // absolute

    expect(entries).toEqual([
      { from: "a", to: "b", direction: "forward" },
      { from: "b", to: "a", direction: "backward" },
      { from: "a", to: "b", direction: "forward" },
      { from: "b", to: "d", direction: "jump" },
      { from: "d", to: "b", direction: "backward" },
      { from: "b", to: "d", direction: "jump" }
    ]);
  });

  it("the initial entry is a jump with from: null", async () => {
    const entries: Entry[] = [];
    const machine = createLinearJourney({ steps: ["a", "b"], context: {} });
    machine.subscriptions.subscribeEvent("stepEnter", ({ from, to, direction }) => {
      entries.push({ from, to, direction });
    });
    machine.controls.start();
    await flush();
    expect(entries).toEqual([{ from: null, to: "a", direction: "jump" }]);
  });

  it("graph send reports jump, with and without work", async () => {
    const entries: Entry[] = [];
    const machine = createGraphJourney({
      steps: { a: {}, b: {}, c: {} },
      transitions: {
        GO: { from: "a", to: "b" },
        FINISH: { from: "b", to: "c" }
      },
      initial: "a",
      context: {}
    });
    machine.controls.start();
    await flush();
    machine.subscriptions.subscribeEvent("stepEnter", ({ from, to, direction }) => {
      entries.push({ from, to, direction });
    });

    await machine.send("GO");
    await machine.send("FINISH", { run: () => "done" });

    expect(entries).toEqual([
      { from: "a", to: "b", direction: "jump" },
      { from: "b", to: "c", direction: "jump" }
    ]);
  });
});
