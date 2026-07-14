import { describe, expect, it } from "vitest";
import { createLinearJourney } from "@rxova/journey-core";
import { createReplayPlugin, serializeReplaySession } from "@rxova/journey-core/replay";
import { flush } from "../../../__tests__/helpers";

describe("replay plugin", () => {
  it("records lifecycle activity into an exportable session", async () => {
    const machine = createLinearJourney(
      { steps: ["a", "b"], context: { n: 0 } },
      { plugins: [createReplayPlugin({ now: () => 7 })] as const }
    );
    machine.controls.start();
    await flush();
    await machine.navigate.goToNextStep();
    machine.context.update((c) => ({ n: c.n + 1 }));
    await machine.navigate.goToPreviousStep(9); // blocked? no — pointer clamps; use out-of-bounds below
    await machine.navigate.goToPreviousStep();

    const session = machine.plugins.replay.getReplaySession();
    const kinds = session.entries.map((entry) => entry.kind);
    expect(kinds[0]).toBe("status");
    expect(kinds).toContain("transition");
    expect(kinds).toContain("context");
    expect(kinds).toContain("navigationBlocked");
    expect(session.entries[0]).toMatchObject({ at: 7, snapshot: expect.anything() });

    const exported = machine.plugins.replay.exportReplaySession({ pretty: true });
    expect(JSON.parse(exported)).toMatchObject({ startedAt: 7 });
  });

  it("caps entries at maxEntries, dropping the oldest", async () => {
    const machine = createLinearJourney(
      { steps: ["a"], context: { n: 0 } },
      { plugins: [createReplayPlugin({ maxEntries: 3, captureSnapshots: false })] as const }
    );
    machine.controls.start();
    await flush();
    for (let index = 0; index < 5; index += 1) {
      machine.context.update((c) => ({ n: c.n + 1 }));
    }

    const session = machine.plugins.replay.getReplaySession();
    expect(session.entries).toHaveLength(3);
    expect(session.entries.every((entry) => entry.kind === "context")).toBe(true);
    expect(session.entries.every((entry) => !("snapshot" in entry))).toBe(true);
    expect(machine.getSnapshot().plugins.replay).toEqual({ entryCount: 3 });
  });

  it("clearReplaySession starts a fresh session", async () => {
    const machine = createLinearJourney(
      { steps: ["a"], context: {} },
      { plugins: [createReplayPlugin()] as const }
    );
    machine.controls.start();
    await flush();
    machine.plugins.replay.clearReplaySession();
    expect(machine.plugins.replay.getReplaySession().entries).toEqual([]);
  });

  it("serializeReplaySession survives errors, dates, and circular data", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    const session = {
      startedAt: 1,
      entries: [
        {
          at: 2,
          kind: "error" as const,
          data: { error: new Error("boom"), when: new Date(0), circular }
        }
      ]
    };
    const parsed = JSON.parse(serializeReplaySession(session));
    expect(parsed.entries[0].data.error).toMatchObject({ name: "Error", message: "boom" });
    expect(parsed.entries[0].data.when).toBe("1970-01-01T00:00:00.000Z");
    expect(parsed.entries[0].data.circular.self).toBe("[circular]");
  });
});

describe("toSerializable edge cases", () => {
  it("handles bigints, functions, and symbols", () => {
    const session = {
      startedAt: 1,
      entries: [
        {
          at: 2,
          kind: "context" as const,
          data: { big: 10n, fn: () => undefined, sym: Symbol("x"), nested: [undefined] }
        }
      ]
    };
    const parsed = JSON.parse(serializeReplaySession(session));
    expect(parsed.entries[0].data).toEqual({
      big: "10",
      fn: "[unsupported:function]",
      sym: "[unsupported:symbol]",
      nested: [null]
    });
  });
});

describe("stackless errors", () => {
  it("serializes errors without a stack property", () => {
    const error = new Error("bare");
    delete (error as { stack?: string }).stack;
    const parsed = JSON.parse(
      serializeReplaySession({ startedAt: 1, entries: [{ at: 2, kind: "error", data: error }] })
    );
    expect(parsed.entries[0].data).toEqual({ name: "Error", message: "bare" });
  });
});
