import { afterEach, describe, expect, it, vi } from "vitest";
import { createLinearJourney } from "@rxova/journey-core";
import { createPersistencePlugin } from "@rxova/journey-core/persistence";
import { flush } from "@rxova/journey-core/testing";
import type { JourneyStorage } from "@rxova/journey-core/persistence";

const KEY = "journey";

/**
 * `JourneyStorage.setItem` is declared as `void | Promise<void>`, so async
 * adapters (IndexedDB wrappers, remote key-value stores) are supported. The
 * plugin used to discard that promise with `void`, which turned a rejecting
 * adapter into an unhandled rejection — fatal under Node's default
 * `--unhandled-rejections=throw`.
 */
function rejectingStorage(error: unknown): JourneyStorage & { calls: number } {
  return {
    calls: 0,
    getItem: () => null,
    setItem(this: { calls: number }) {
      this.calls += 1;
      return Promise.reject(error);
    },
    removeItem: () => undefined
  } as JourneyStorage & { calls: number };
}

describe("persistence with an async storage adapter", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("contains a rejected setItem instead of leaking an unhandled rejection", async () => {
    const failure = new Error("quota exceeded");
    const storage = rejectingStorage(failure);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const machine = createLinearJourney(
      { steps: ["a", "b", "c"], context: { n: 0 } },
      { plugins: [createPersistencePlugin({ key: KEY, storage })] as const }
    );
    machine.controls.start();
    await flush();
    await machine.navigate.goToNextStep();
    await flush();

    // Reaching the reporter is what proves the promise was handled: an
    // unhandled rejection would never route through it.
    expect(storage.calls).toBeGreaterThan(0);
    expect(consoleError).toHaveBeenCalled();
    expect(consoleError.mock.calls.some((call) => call.includes(failure))).toBe(true);
  });

  it("keeps the machine transitioning after a write failure", async () => {
    const storage = rejectingStorage(new Error("storage down"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const machine = createLinearJourney(
      { steps: ["a", "b", "c"], context: { n: 0 } },
      { plugins: [createPersistencePlugin({ key: KEY, storage })] as const }
    );
    machine.controls.start();
    await flush();

    await machine.navigate.goToNextStep();
    await machine.navigate.goToNextStep();
    await flush();

    expect(machine.getSnapshot().currentStep?.id).toBe("c");
    expect(machine.getSnapshot().status).toBe("running");
  });

  it("still writes through a resolving async adapter", async () => {
    const written = new Map<string, string>();
    const storage: JourneyStorage = {
      getItem: (key) => written.get(key) ?? null,
      setItem: (key, value) =>
        Promise.resolve().then(() => {
          written.set(key, value);
        }),
      removeItem: (key) => void written.delete(key)
    };

    const machine = createLinearJourney(
      { steps: ["a", "b"], context: { n: 0 } },
      { plugins: [createPersistencePlugin({ key: KEY, storage })] as const }
    );
    machine.controls.start();
    await flush();
    await machine.navigate.goToNextStep();
    await flush();

    const record = JSON.parse(written.get(KEY) as string) as { timeline: string[] };
    expect(record.timeline).toEqual(["a", "b"]);
  });
});
