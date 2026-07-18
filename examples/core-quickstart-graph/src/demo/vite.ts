import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const workspacePath = (relative: string) =>
  fileURLToPath(new URL(`../../../../${relative}`, import.meta.url));

export const createExampleViteConfig = ({ reactApp = false }: { reactApp?: boolean } = {}) =>
  defineConfig({
    plugins: reactApp ? [react()] : [],
    resolve: {
      alias: [
        {
          find: "@rxova/journey-core/analytics",
          replacement: workspacePath("packages/core/src/plugins/analytics/analytics.ts")
        },
        {
          find: "@rxova/journey-core/autosave",
          replacement: workspacePath("packages/core/src/plugins/autosave/autosave.ts")
        },
        {
          find: "@rxova/journey-core/diagnostics",
          replacement: workspacePath("packages/core/src/plugins/diagnostics/diagnostics.ts")
        },
        {
          find: "@rxova/journey-core/execution-paths",
          replacement: workspacePath("packages/core/src/plugins/execution-paths/execution-paths.ts")
        },
        {
          find: "@rxova/journey-core/persistence",
          replacement: workspacePath("packages/core/src/plugins/persistence/persistence.ts")
        },
        {
          find: "@rxova/journey-core/replay",
          replacement: workspacePath("packages/core/src/plugins/replay/replay.ts")
        },
        {
          find: "@rxova/journey-core/subscription-enhancer",
          replacement: workspacePath(
            "packages/core/src/plugins/subscription-enhancer/subscription-enhancer.ts"
          )
        },
        {
          find: "@rxova/journey-core/convert",
          replacement: workspacePath("packages/core/src/convert/convert.ts")
        },
        {
          find: /^@rxova\/journey-core$/,
          replacement: workspacePath("packages/core/src/index.ts")
        },
        {
          find: "@rxova/journey-react/headless",
          replacement: workspacePath("packages/react/src/headless/headless.ts")
        },
        {
          find: "@rxova/journey-react/graph",
          replacement: workspacePath("packages/react/src/graph/graph.tsx")
        },
        {
          find: /^@rxova\/journey-react$/,
          replacement: workspacePath("packages/react/src/index.ts")
        }
      ],
      dedupe: ["react", "react-dom"]
    }
  });
