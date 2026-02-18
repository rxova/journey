import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: [
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
      "apps/**/test/**/*.test.tsx"
    ],
    globals: true,
    environment: "jsdom",
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary", "html", "json-summary", "lcov"],
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
