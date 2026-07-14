import { describe, expect, it } from "vitest";
import { createLinearJourney } from "@rxova/journey-core";
import { createSubscriptionEnhancerPlugin } from "@rxova/journey-core/subscription-enhancer";
import { flush } from "./helpers";

function machineWithEnhancer() {
  return createLinearJourney(
    { steps: ["a", "b"], context: {} },
    { plugins: [createSubscriptionEnhancerPlugin()] as const }
  );
}

describe("subscription-enhancer plugin", () => {
  it("fires lifecycle-filtered listeners for each verb", async () => {
    const machine = machineWithEnhancer();
    const api = machine.plugins["subscription-enhancer"];
    const fired: string[] = [];
    api.subscribeStart(() => fired.push("start"));
    api.subscribePause(() => fired.push("pause"));
    api.subscribeResume(() => fired.push("resume"));
    api.subscribeComplete(() => fired.push("complete"));
    api.subscribeRestart(() => fired.push("restart"));
    api.subscribeTerminate(() => fired.push("terminate"));

    machine.controls.start();
    await flush();
    machine.controls.pause();
    machine.controls.resume();
    machine.controls.complete();
    machine.controls.restart();
    await flush();
    machine.controls.terminate();

    expect(fired).toEqual(["start", "pause", "resume", "complete", "restart", "terminate"]);
  });

  it("restart is not reported as start, and unsubscribe works", async () => {
    const machine = machineWithEnhancer();
    const api = machine.plugins["subscription-enhancer"];
    const starts: string[] = [];
    const offStart = api.subscribeStart(({ previous, current }) =>
      starts.push(`${previous}→${current}`)
    );

    machine.controls.start();
    await flush();
    machine.controls.complete();
    machine.controls.restart(); // completed → running: not a start
    await flush();
    expect(starts).toEqual(["idle→running"]);

    offStart();
    machine.controls.terminate();
    expect(starts).toHaveLength(1);
  });
});
