import { baseVitestConfig } from "@rxova/repo-config/vitest";

// One suite, over the size figures the landing page prints. The site itself is
// not held to a coverage gate.
export default baseVitestConfig({
  root: import.meta.dirname,
  include: ["test/**/*.test.ts"],
  coverage: false,
  silent: true,
});
