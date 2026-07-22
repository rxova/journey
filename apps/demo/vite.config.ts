import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: "@rxova/journey-react/graph",
        replacement: fileURLToPath(new URL("../../packages/react/src/graph.tsx", import.meta.url))
      },
      {
        find: /^@rxova\/journey-react$/,
        replacement: fileURLToPath(new URL("../../packages/react/src/index.ts", import.meta.url))
      },
      {
        find: /^@rxova\/journey-core$/,
        replacement: fileURLToPath(new URL("../../packages/core/src/index.ts", import.meta.url))
      },
      {
        find: "@rxova/journey-devtools-bridge",
        replacement: fileURLToPath(
          new URL("../../packages/devtools-bridge/src/index.ts", import.meta.url)
        )
      }
    ],
    dedupe: ["react", "react-dom"]
  }
});
