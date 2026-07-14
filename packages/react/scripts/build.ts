import { rmSync } from "node:fs";
import { build } from "esbuild";

rmSync("dist", { recursive: true, force: true });

const common = {
  bundle: true,
  target: "es2020",
  minify: true,
  sourcemap: true,
  legalComments: "none",
  platform: "neutral",
  format: "esm",
  external: [
    "react",
    "react/jsx-runtime",
    "react/jsx-dev-runtime",
    "@rxova/journey-core",
    "@rxova/journey-core/persistence"
  ]
};

for (const [entryPoint, outfile] of [
  ["src/index.ts", "dist/index.js"],
  ["src/client.ts", "dist/client.js"],
  ["src/headless/index.ts", "dist/headless/index.js"],
  ["src/graph/index.ts", "dist/graph/index.js"]
] as const) {
  await build({
    ...common,
    entryPoints: [entryPoint],
    outfile
  });

  await build({
    ...common,
    entryPoints: [entryPoint],
    outfile: outfile.replace(/\.js$/, ".cjs"),
    platform: "node",
    format: "cjs"
  });
}
