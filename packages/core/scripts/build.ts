import { rmSync } from "node:fs";
import { build } from "esbuild";

rmSync("dist", { recursive: true, force: true });

const common = {
  bundle: true,
  target: "es2020",
  minify: true,
  sourcemap: true,
  legalComments: "none"
};

await build({
  ...common,
  entryPoints: ["src/index.ts"],
  outfile: "dist/index.js",
  platform: "neutral",
  format: "esm"
});

await build({
  ...common,
  entryPoints: ["src/index.ts"],
  outfile: "dist/index.cjs",
  platform: "node",
  format: "cjs"
});

await build({
  ...common,
  entryPoints: ["src/persistence.ts"],
  outfile: "dist/persistence.js",
  platform: "neutral",
  format: "esm"
});

await build({
  ...common,
  entryPoints: ["src/persistence.ts"],
  outfile: "dist/persistence.cjs",
  platform: "node",
  format: "cjs"
});
