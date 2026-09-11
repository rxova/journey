import { createLinearJourney, type JourneyRuntimeOptions } from "@rxova/journey-core";

// This entry is the sanctioned bridge to package internals: tests must not
// reach into src with parent-relative paths, so pure helpers that warrant
// direct unit coverage are re-exported here rather than made public API.
// eslint-disable-next-line no-restricted-imports
export { eventWorkKey, shallowEqual } from "../core/helpers";

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
