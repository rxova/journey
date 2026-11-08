import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Generated for the standalone (CodeSandbox) checkout: the monorepo variant of
// this file aliases `@rxova/journey-*` at the workspace sources, four levels up.
// Outside the monorepo those paths do not exist, so this variant resolves the
// packages from node_modules like any consumer does.
export const createExampleViteConfig = ({ reactApp = false }: { reactApp?: boolean } = {}) =>
  defineConfig({
    plugins: reactApp ? [react()] : [],
    resolve: {
      dedupe: ["react", "react-dom"],
    },
  });
