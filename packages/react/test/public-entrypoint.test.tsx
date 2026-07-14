import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import * as reactEntry from "../src";
import * as reactClientEntry from "../src/client";
import * as graphEntry from "../src/graph";
import * as headlessEntry from "../src/headless";

describe("react public entrypoint", () => {
  it("the root exports the wizard tier", () => {
    expect(reactEntry.Wizard).toBeTypeOf("function");
    expect(reactEntry.Wizard.Step).toBeTypeOf("function");
    expect(reactEntry.useWizard).toBeTypeOf("function");
    expect(reactEntry.useWizardSelector).toBeTypeOf("function");
    expect(reactEntry.useWizardStep).toBeTypeOf("function");
    expect(reactEntry.createWizard).toBeTypeOf("function");
  });

  it("the graph subpath exports the bundle factory", () => {
    expect(graphEntry.createGraphJourney).toBeTypeOf("function");
  });

  it("the headless subpath exports machine-argument hooks and useOwnedJourney", () => {
    expect(headlessEntry.useOwnedJourney).toBeTypeOf("function");
    expect(headlessEntry.useJourneySnapshot).toBeTypeOf("function");
    expect(headlessEntry.useJourneySelector).toBeTypeOf("function");
    expect(headlessEntry.useJourneyComputed).toBeTypeOf("function");
    expect(headlessEntry.useStepAsyncState).toBeTypeOf("function");
    expect(headlessEntry.useJourneyEvent).toBeTypeOf("function");
    expect(headlessEntry.useJourneyStepLifecycle).toBeTypeOf("function");
  });

  it("the deleted runtime-object API is gone", () => {
    const legacyExports = [
      "createJourney",
      "createJourneyFactory",
      "createLinearJourney",
      "createGraphJourney",
      "createHeadlessJourney",
      "useJourney"
    ];
    for (const name of legacyExports) {
      expect((reactEntry as Record<string, unknown>)[name]).toBeUndefined();
    }
  });

  it("re-exports the wizard tier from the client subpath", () => {
    expect(reactClientEntry.Wizard).toBe(reactEntry.Wizard);
    expect(reactClientEntry.useWizard).toBe(reactEntry.useWizard);
    expect(reactClientEntry.createWizard).toBe(reactEntry.createWizard);
  });

  it("keeps the root entry server-safe and the client subpath client-marked", () => {
    const rootEntry = readFileSync(resolve(__dirname, "../src/index.ts"), "utf8");
    const clientEntry = readFileSync(resolve(__dirname, "../src/client.ts"), "utf8");

    expect(rootEntry.startsWith('"use client";')).toBe(false);
    expect(clientEntry.startsWith('"use client";')).toBe(true);
  });
});
