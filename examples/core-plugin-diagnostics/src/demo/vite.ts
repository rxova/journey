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
          find: "@rxova/journey-core/plugins",
          replacement: workspacePath("packages/core/src/plugins/index.ts")
        },
        {
          find: /^@rxova\/journey-core$/,
          replacement: workspacePath("packages/core/src/index.ts")
        },
        {
          find: "@rxova/journey-react/graph",
          replacement: workspacePath("packages/react/src/graph.tsx")
        },
        {
          find: /^@rxova\/journey-react$/,
          replacement: workspacePath("packages/react/src/index.ts")
        }
      ],
      dedupe: ["react", "react-dom"]
    }
  });
