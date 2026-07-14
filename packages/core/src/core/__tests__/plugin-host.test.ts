import { describe, expect, it, vi } from "vitest";
import { createLinearJourney, type JourneyPlugin } from "@rxova/journey-core";
import { flush } from "../../__tests__/helpers";

describe("plugins — observe + extend, never intercept", () => {
  it("contributes a namespaced machine API and snapshot extension", async () => {
    const counter: JourneyPlugin<"counter", { count(): number }, { count: number }> = {
      name: "counter",
      setup(host) {
        let count = 0;
        host.onTransition(() => {
          count += 1;
        });
        return {
          api: { count: () => count },
          deriveSnapshot: (_snapshot, previous) =>
            previous?.count === count ? previous : { count }
        };
      }
    };

    const machine = createLinearJourney(
      { steps: ["a", "b"], context: {} },
      { plugins: [counter] as const }
    );
    machine.controls.start();
    await flush();
    await machine.navigate.goToNextStep();

    expect(machine.plugins.counter.count()).toBe(2); // initial entry + one navigation
    expect(machine.getSnapshot().plugins).toEqual({ counter: { count: 2 } });
  });

  it("host taps observe blocked navigations, status, context, and dispose", async () => {
    const events: string[] = [];
    const observer: JourneyPlugin<"observer", undefined, never> = {
      name: "observer",
      setup(host) {
        host.onNavigationBlocked(({ reason }) => events.push(`blocked:${reason}`));
        host.onStatusChange(({ current }) => events.push(`status:${current}`));
        host.onContextChange(() => events.push("context"));
        host.onDispose(() => events.push("dispose"));
        return {};
      }
    };

    const machine = createLinearJourney(
      { steps: ["a"], context: { n: 0 } },
      { plugins: [observer] as const }
    );
    machine.controls.start();
    await flush();
    await machine.navigate.goToPreviousStep();
    machine.context.update((c) => ({ n: c.n + 1 }));
    machine.dispose();

    expect(events).toEqual(["status:running", "blocked:out-of-bounds", "context", "dispose"]);
  });

  it("rejects duplicate plugin names", () => {
    const p = (name: string): JourneyPlugin => ({ name, setup: () => ({}) });
    expect(() =>
      createLinearJourney({ steps: ["a"], context: {} }, { plugins: [p("dup"), p("dup")] as const })
    ).toThrow(/duplicate plugin name "dup"/);
  });

  it("plugin tap exceptions are isolated", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const faulty: JourneyPlugin<"faulty", undefined, never> = {
      name: "faulty",
      setup(host) {
        host.onTransition(() => {
          throw new Error("plugin bug");
        });
        return {};
      }
    };
    const machine = createLinearJourney(
      { steps: ["a", "b"], context: {} },
      { plugins: [faulty] as const }
    );
    machine.controls.start();
    await flush();
    expect(await machine.navigate.goToNextStep()).toEqual({ ok: true, from: "a", to: "b" });
    consoleError.mockRestore();
  });
});
