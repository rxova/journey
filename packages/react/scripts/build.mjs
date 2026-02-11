import { rmSync } from "node:fs";
import { build } from "esbuild";

rmSync("dist", { recursive: true, force: true });

const common = {
  bundle: true,
  target: "es2020",
  minify: true,
  sourcemap: true,
  legalComments: "none",
  entryPoints: ["src/index.ts"],
  outfile: "dist/index.js",
  platform: "neutral",
  format: "esm",
  external: ["react", "react/jsx-runtime", "react/jsx-dev-runtime", "@rxova/journey-core"]
};

await build(common);

await build({
  ...common,
  outfile: "dist/index.cjs",
  platform: "node",
  format: "cjs"
});
