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
    "src/convert/convert.ts",
    "src/plugins/analytics/analytics.ts",
    "src/plugins/autosave/autosave.ts",
    "src/plugins/diagnostics/diagnostics.ts",
    "src/plugins/persistence/persistence.ts",
    "src/plugins/replay/replay.ts",
    "src/plugins/execution-paths/execution-paths.ts",
    "src/plugins/subscription-enhancer/subscription-enhancer.ts"
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
