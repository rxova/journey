import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./manifest.config";

export default defineConfig({
  resolve: {
    alias: {
      "@rxova/journey-core": fileURLToPath(
        new URL("../../packages/core/src/index.ts", import.meta.url)
      ),
      "@rxova/journey-devtools-bridge": fileURLToPath(
        new URL("../../packages/devtools-bridge/src/index.ts", import.meta.url)
      )
    }
  },
  plugins: [react(), crx({ manifest })],
  build: {
    target: "es2020",
    sourcemap: true,
    rollupOptions: {
      input: {
        panel: "src/panel.html",
        integrationHarness: "src/integration-harness.html"
      }
    }
  }
});
