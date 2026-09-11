import { describe, expect, it, vi } from "vitest";
import { createGraphJourney } from "@rxova/journey-core";
import { linearToGraphDefinition } from "@rxova/journey-core/convert";
import { flush } from "@rxova/journey-core/testing";

describe("linearToGraphDefinition", () => {
  it("converts declared order into NEXT/PREVIOUS transitions", () => {
    const definition = linearToGraphDefinition({
      steps: ["a", "b", "c"],
      context: { n: 1 }
    });

    expect(definition.initial).toBe("a");
    expect(definition.context).toEqual({ n: 1 });
    expect(Object.keys(definition.steps)).toEqual(["a", "b", "c"]);
    expect(definition.transitions.NEXT).toEqual([
      { from: "a", to: "b" },
      { from: "b", to: "c" }
    ]);
    expect(definition.transitions.PREVIOUS).toEqual([
      { from: "b", to: "a" },
      { from: "c", to: "b" }
    ]);
  });

  it("carries hooks and metadata over unchanged", () => {
    const onEnter = vi.fn();
    const definition = linearToGraphDefinition({
      steps: [{ id: "a", metadata: { label: "A" }, onEnter }, "b"],
      context: {}
    });
    expect(definition.steps.a).toMatchObject({ metadata: { label: "A" }, onEnter });
    expect(definition.steps.b).toEqual({ metadata: {} });
  });

  it("a single-step journey has no NEXT/PREVIOUS events", () => {
    const definition = linearToGraphDefinition({ steps: ["only"], context: {} });
    expect(definition.transitions).toEqual({});
  });

  it("a single-step journey also has no jump events", () => {
    const definition = linearToGraphDefinition(
      { steps: ["only"], context: {} },
      { includeJumpEvents: true }
    );
    expect(definition.transitions).toEqual({});
  });

  it("optionally generates jump transitions to preserve linear free jumps", () => {
    const definition = linearToGraphDefinition(
      { steps: ["a", "b", "c"], context: {} },
      { includeJumpEvents: true }
    );
    expect(definition.transitions.GO_TO_c).toEqual([
      { from: "a", to: "c" },
      { from: "b", to: "c" }
    ]);
  });

  it("throws on an empty linear definition", () => {
    expect(() => linearToGraphDefinition({ steps: [], context: {} })).toThrow(/at least one step/);
  });

  it("the converted definition drives a graph runtime", async () => {
    const machine = createGraphJourney(
      linearToGraphDefinition({ steps: ["a", "b", "c"], context: {} })
    );
    machine.controls.start();
    await flush();

    expect(await machine.send("NEXT")).toEqual({ ok: true, from: "a", to: "b" });
    expect(await machine.send("NEXT")).toEqual({ ok: true, from: "b", to: "c" });
    expect(await machine.send("NEXT")).toMatchObject({
      ok: false,
      reason: "no-enabled-transition"
    });
    expect(await machine.send("PREVIOUS")).toEqual({ ok: true, from: "c", to: "b" });
  });
});

describe("hook carry-over", () => {
  it("carries onLeave as well as onEnter", () => {
    const onLeave = vi.fn();
    const definition = linearToGraphDefinition({
      steps: [{ id: "a", onLeave }, "b"],
      context: {}
    });
    expect(definition.steps.a).toMatchObject({ onLeave });
  });
});
