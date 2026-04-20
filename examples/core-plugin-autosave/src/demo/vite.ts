/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export const createExampleViteConfig = ({ reactApp = false }: { reactApp?: boolean } = {}) =>
  defineConfig({
    plugins: reactApp ? [react()] : [],
    resolve: {
      alias: [
        {
          find: "@rxova/journey-core/analytics",
          replacement: fileURLToPath(
            new URL("../../../../packages/core/src/plugins/analytics/index.ts", import.meta.url)
          )
        },
        {
          find: "@rxova/journey-core/autosave",
          replacement: fileURLToPath(
            new URL("../../../../packages/core/src/plugins/autosave/index.ts", import.meta.url)
          )
        },
        {
          find: "@rxova/journey-core/diagnostics",
          replacement: fileURLToPath(
            new URL("../../../../packages/core/src/plugins/diagnostics/index.ts", import.meta.url)
          )
        },
        {
          find: "@rxova/journey-core/execution-paths",
          replacement: fileURLToPath(
            new URL(
              "../../../../packages/core/src/plugins/execution-paths/index.ts",
              import.meta.url
            )
          )
        },
        {
          find: "@rxova/journey-core/persistence",
          replacement: fileURLToPath(
            new URL("../../../../packages/core/src/plugins/persistence/index.ts", import.meta.url)
          )
        },
        {
          find: "@rxova/journey-core/replay",
          replacement: fileURLToPath(
            new URL("../../../../packages/core/src/plugins/replay/index.ts", import.meta.url)
          )
        },
        {
          find: /^@rxova\/journey-core$/,
          replacement: fileURLToPath(
            new URL("../../../../packages/core/src/index.ts", import.meta.url)
          )
        },
        {
          find: /^@rxova\/journey-react$/,
          replacement: fileURLToPath(
            new URL("../../../../packages/react/src/index.ts", import.meta.url)
          )
        }
      ],
      dedupe: ["react", "react-dom"]
    }
  });
