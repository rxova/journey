import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import * as reactEntry from "../src";
import * as reactClientEntry from "../src/client";

describe("react public entrypoint", () => {
  it("re-exports createJourney", () => {
    expect(reactEntry.createJourney).toBeTypeOf("function");
  });

  it("re-exports createJourneyFactory", () => {
    expect(reactEntry.createJourneyFactory).toBeTypeOf("function");
  });

  it("re-exports the runtime from the client subpath", () => {
    expect(reactClientEntry.createJourney).toBe(reactEntry.createJourney);
    expect(reactClientEntry.createJourneyFactory).toBe(reactEntry.createJourneyFactory);
  });

  it("keeps the root entry server-safe and the client subpath client-marked", () => {
    const rootEntry = readFileSync(resolve(__dirname, "../src/index.ts"), "utf8");
    const clientEntry = readFileSync(resolve(__dirname, "../src/client.ts"), "utf8");

    expect(rootEntry.startsWith('"use client";')).toBe(false);
    expect(clientEntry.startsWith('"use client";')).toBe(true);
  });
});
