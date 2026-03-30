import { rmSync } from "node:fs";
import { build } from "esbuild";

rmSync("dist", { recursive: true, force: true });

const common = {
  bundle: true,
  target: "es2020",
  minify: true,
  sourcemap: true,
  legalComments: "none",
  entryPoints: [
    "src/index.ts",
    "src/plugins/analytics/index.ts",
    "src/plugins/autosave/index.ts",
    "src/plugins/diagnostics/index.ts",
    "src/plugins/persistence/index.ts",
    "src/plugins/replay/index.ts",
    "src/plugins/execution-paths/index.ts"
  ],
  outdir: "dist",
  outbase: "src",
  platform: "neutral",
  format: "esm"
};

await build(common);

await build({
  ...common,
  platform: "node",
  format: "cjs",
  outExtension: {
    ".js": ".cjs"
  }
});
