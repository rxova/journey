import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@rxova/journey-core": fileURLToPath(
        new URL("../../packages/core/src/index.ts", import.meta.url)
      ),
      "@rxova/journey-react": fileURLToPath(
        new URL("../../packages/react/src/index.ts", import.meta.url)
      ),
      "@rxova/journey-devtools-bridge": fileURLToPath(
        new URL("../../packages/devtools-bridge/src/index.ts", import.meta.url)
      )
    },
    dedupe: ["react", "react-dom"]
  }
});
