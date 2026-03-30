import { describe, expect, it } from "vitest";

import * as bridgeEntry from "../src";

describe("devtools bridge public entrypoint", () => {
  it("re-exports the bridge API and protocol constants", () => {
    expect(bridgeEntry.attachJourneyDevtools).toBeTypeOf("function");
    expect(bridgeEntry.JOURNEY_DEVTOOLS_CHANNEL).toBeTypeOf("string");
  });
});
