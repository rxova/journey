import { baseVitestConfig } from "@rxova/repo-config/vitest";

// The repository's own scripts (scripts/), outside any package. Coverage is
// reported, not gated: the scripts were never held to the packages' per-file
// bar, and two of them are mostly exercised as spawned CLIs, where v8 cannot
// see the lines they run.
export default baseVitestConfig({
  root: import.meta.dirname,
  include: ["scripts/**/*.test.ts"],
  coverageInclude: ["scripts/**/*.ts"],
  exclude: ["scripts/**/*.test.ts"],
  thresholds: false,
  // Several suites spawn Node with tsx to run a script as its CLI; a cold start
  // on a Windows runner can take most of Vitest's 5 s default by itself.
  testTimeout: 30_000,
  reporter: ["text", "json-summary"],
  silent: true,
});
