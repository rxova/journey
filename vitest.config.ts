import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";

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
        find: "@rxova/journey-react",
        replacement: fileURLToPath(new URL("./packages/react/src/index.ts", import.meta.url))
      },
      {
        find: "@rxova/journey-devtools-bridge",
        replacement: fileURLToPath(
          new URL("./packages/devtools-bridge/src/index.ts", import.meta.url)
        )
      }
    ]
  },
  test: {
    include: [
      "packages/**/test/**/*.test.ts",
      "packages/**/test/**/*.test.tsx",
      "apps/**/test/**/*.test.ts",
      "apps/**/test/**/*.test.tsx",
      // The repo's own tooling. These sit next to the scripts they cover rather
      // than in a test/ directory, because the scripts are not a package.
      "scripts/**/*.test.ts"
    ],
    globals: true,
    environment: "jsdom",
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary", "html", "json-summary", "lcov"],
      thresholds: {
        branches: 95,
        functions: 95,
        lines: 95,
        statements: 95
      },
      include: [
        "packages/*/src/**/*.ts",
        "packages/*/src/**/*.tsx",
        "apps/devtools/src/**/*.ts",
        "apps/devtools/src/**/*.tsx"
      ],
      exclude: ["packages/**/types.ts"]
    }
  }
});
