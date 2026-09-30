import { baseVitestConfig } from "@rxova/repo-config/vitest";
import { setupFile, sourceAliases } from "../../test/source-aliases";

// The extension's suites live in test/, beside src/ rather than inside it;
// coverage is per file over src/, the gate the old `coverage` script enforced.
export default baseVitestConfig({
  root: import.meta.dirname,
  environment: "jsdom",
  include: ["test/**/*.test.{ts,tsx}"],
  exclude: ["src/**/*.d.ts"],
  reporter: ["text", "json-summary", "lcov"],
  alias: sourceAliases,
  setupFiles: [setupFile],
  globals: true,
  silent: true
});
