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
  reporter: ["text", "json-summary"],
  silent: true
});
