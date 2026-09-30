import { baseVitestConfig } from "@rxova/repo-config/vitest";
import { setupFile, sourceAliases } from "../../test/source-aliases";

// Per-file 95% on every axis over src/, the gate the old per-package `coverage`
// script enforced. Suites run in jsdom against the workspace sources.
export default baseVitestConfig({
  root: import.meta.dirname,
  environment: "jsdom",
  include: ["src/**/__tests__/**/*.test.{ts,tsx}", "test/**/*.test.ts"],
  exclude: ["src/**/__tests__/**", "src/**/types.ts", "src/types/**", "src/**/*.d.ts"],
  reporter: ["text", "json-summary", "lcov"],
  alias: sourceAliases,
  setupFiles: [setupFile],
  globals: true,
  silent: true,
});
