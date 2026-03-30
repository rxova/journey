import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: [
      {
        find: "@rxova/journey-core/execution-paths",
        replacement: fileURLToPath(
          new URL("../../packages/core/src/plugins/execution-paths/index.ts", import.meta.url)
        )
      },
      {
        find: "@rxova/journey-core/persistence",
        replacement: fileURLToPath(
          new URL("../../packages/core/src/plugins/persistence/index.ts", import.meta.url)
        )
      },
      {
        find: "@rxova/journey-core",
        replacement: fileURLToPath(new URL("../../packages/core/src/index.ts", import.meta.url))
      },
      {
        find: "@rxova/journey-react",
        replacement: fileURLToPath(new URL("../../packages/react/src/index.ts", import.meta.url))
      },
      {
        find: "@rxova/journey-devtools-bridge",
        replacement: fileURLToPath(
          new URL("../../packages/devtools-bridge/src/index.ts", import.meta.url)
        )
      }
    ]
  },
  test: {
    globals: true,
    environment: "jsdom",
    include: ["test/**/*.test.ts", "test/**/*.test.tsx"],
    exclude: ["e2e/**"]
  }
});
