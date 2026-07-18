import { createLinearJourney, type JourneyRuntimeOptions } from "@rxova/journey-core";

/** Waits a macrotask so pending entry effects settle. */
export const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

export const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** A started 4-step linear journey (a → b → c → d), settled and ready. */
export async function startedLinear(
  options: JourneyRuntimeOptions<readonly [], "a" | "b" | "c" | "d"> = {}
) {
  const machine = createLinearJourney(
    { steps: ["a", "b", "c", "d"], context: { count: 0 } },
    options
  );
  machine.controls.start();
  await flush();
  return machine;
}
