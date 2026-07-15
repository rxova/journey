import { describe, expect, it } from "vitest";
import { createLinearJourney } from "@rxova/journey-core";
import { buildPersistedState, parsePersistedState } from "@rxova/journey-core/persistence";
import { flush } from "@rxova/journey-core/testing";

describe("buildPersistedState", () => {
  it("extracts the serializable slice from a live snapshot", async () => {
    const machine = createLinearJourney(
      { steps: ["a", "b"], context: { n: 1 } },
      { autoStart: true }
    );
    await flush();
    await machine.navigate.goToNextStep();

    expect(buildPersistedState(machine.getSnapshot(), 123)).toEqual({
      status: "running",
      context: { n: 1 },
      timeline: ["a", "b"],
      currentIndex: 1,
      savedAt: 123
    });
  });
});

describe("parsePersistedState", () => {
  it("round-trips what buildPersistedState wrote", async () => {
    const machine = createLinearJourney({ steps: ["a"], context: {} }, { autoStart: true });
    await flush();
    const state = buildPersistedState(machine.getSnapshot(), 5);
    expect(parsePersistedState(JSON.stringify(state))).toEqual(state);
  });

  it.each([
    ["null input", null],
    ["broken json", "{oops"],
    ["primitive json", "42"],
    ["json null", "null"],
    ["missing status", JSON.stringify({ timeline: [], currentIndex: 0, savedAt: 1 })],
    ["missing timeline", JSON.stringify({ status: "running", currentIndex: 0, savedAt: 1 })],
    [
      "string index",
      JSON.stringify({ status: "running", timeline: [], currentIndex: "0", savedAt: 1 })
    ],
    ["missing savedAt", JSON.stringify({ status: "running", timeline: [], currentIndex: 0 })]
  ])("rejects %s", (_label, raw) => {
    expect(parsePersistedState(raw as string | null)).toBeNull();
  });
});
