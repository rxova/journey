import { rmSync } from "node:fs";
import { build } from "esbuild";

rmSync("dist", { recursive: true, force: true });

const common = {
  bundle: true,
  target: "es2020",
  minify: true,
  sourcemap: true,
  legalComments: "none",
  entryPoints: ["src/index.ts", "src/plugins/index.ts"],
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
