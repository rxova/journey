import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@\//,
        replacement: fileURLToPath(new URL("./", import.meta.url))
      }
    ]
  },
  build: {
    target: "es2020",
    outDir: "dist",
    emptyOutDir: false,
    sourcemap: true,
    minify: "esbuild",
    lib: {
      entry: {
        index: "src/index.ts",
        "core/index": "src/core/index.ts",
        "react/index": "src/react/index.ts"
      },
      formats: ["es", "cjs"],
      fileName: (format, entryName) => {
        if (format === "es") {
          return `${entryName}.js`;
        }
        return `${entryName}.cjs`;
      }
    },
    rollupOptions: {
      external: ["react"],
      treeshake: true
    }
  }
});
