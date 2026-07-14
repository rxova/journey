import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";

const coverageInclude = process.env.JOURNEY_COVERAGE_INCLUDE?.split(",") ?? [
  "packages/*/src/**/*.ts",
  "packages/*/src/**/*.tsx",
  "apps/devtools/src/**/*.ts",
  "apps/devtools/src/**/*.tsx"
];

export default defineConfig({
  resolve: {
    alias: [
      {
        find: "@rxova/journey-core/analytics",
        replacement: fileURLToPath(
          new URL("./packages/core/src/plugins/analytics/index.ts", import.meta.url)
        )
      },
      {
        find: "@rxova/journey-core/autosave",
        replacement: fileURLToPath(
          new URL("./packages/core/src/plugins/autosave/index.ts", import.meta.url)
        )
      },
      {
        find: "@rxova/journey-core/diagnostics",
        replacement: fileURLToPath(
          new URL("./packages/core/src/plugins/diagnostics/index.ts", import.meta.url)
        )
      },
      {
        find: "@rxova/journey-core/execution-paths",
        replacement: fileURLToPath(
          new URL("./packages/core/src/plugins/execution-paths/index.ts", import.meta.url)
        )
      },
      {
        find: "@rxova/journey-core/persistence",
        replacement: fileURLToPath(
          new URL("./packages/core/src/plugins/persistence/index.ts", import.meta.url)
        )
      },
      {
        find: "@rxova/journey-core/replay",
        replacement: fileURLToPath(
          new URL("./packages/core/src/plugins/replay/index.ts", import.meta.url)
        )
      },
      {
        find: "@rxova/journey-core",
        replacement: fileURLToPath(new URL("./packages/core/src/index.ts", import.meta.url))
      },
      {
        find: "@rxova/journey-react/graph",
        replacement: fileURLToPath(new URL("./packages/react/src/graph/index.ts", import.meta.url))
      },
      {
        find: "@rxova/journey-react/headless",
        replacement: fileURLToPath(
          new URL("./packages/react/src/headless/index.ts", import.meta.url)
        )
      },
      {
        find: "@rxova/journey-react",
        replacement: fileURLToPath(new URL("./packages/react/src/index.ts", import.meta.url))
      },
      {
        find: "@rxova/journey-devtools-bridge",
        replacement: fileURLToPath(
          new URL("./packages/devtools-bridge/src/index.ts", import.meta.url)
        )
      },
      {
        find: "@rxova/journey-common/predicates",
        replacement: fileURLToPath(new URL("./packages/common/src/predicates.ts", import.meta.url))
      },
      {
        find: "@rxova/journey-common/serialization",
        replacement: fileURLToPath(
          new URL("./packages/common/src/serialization.ts", import.meta.url)
        )
      },
      {
        find: "@rxova/journey-common/async",
        replacement: fileURLToPath(new URL("./packages/common/src/async.ts", import.meta.url))
      },
      {
        find: "@rxova/journey-common/dev",
        replacement: fileURLToPath(new URL("./packages/common/src/dev.ts", import.meta.url))
      },
      {
        find: "@rxova/journey-common/origin",
        replacement: fileURLToPath(new URL("./packages/common/src/origin.ts", import.meta.url))
      },
      {
        find: "@rxova/journey-common/memoize",
        replacement: fileURLToPath(new URL("./packages/common/src/memoize.ts", import.meta.url))
      },
      {
        find: "@rxova/journey-common",
        replacement: fileURLToPath(new URL("./packages/common/src/index.ts", import.meta.url))
      }
    ]
  },
  test: {
    include: [
      "packages/**/test/**/*.test.ts",
      "packages/**/test/**/*.test.tsx",
      "packages/common/**/*.test.ts",
      "apps/**/test/**/*.test.ts",
      "apps/**/test/**/*.test.tsx"
    ],
    exclude: ["**/node_modules/**"],
    setupFiles: ["./apps/devtools/test/setup.ts"],
    globals: true,
    silent: true,
    environment: "jsdom",
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary", "html", "json-summary", "lcov"],
      thresholds: {
        statements: 95,
        branches: 95,
        functions: 95,
        lines: 95
      },
      include: coverageInclude,
      exclude: ["**/*.d.ts", "packages/**/types.ts", "packages/*/src/types/**/*.ts"]
    }
  }
});
