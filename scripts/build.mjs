import { rmSync, writeFileSync } from "node:fs";
import { build } from "esbuild";

const entries = [
  { name: "core/index", entry: "src/core/index.ts" },
  { name: "react/index", entry: "src/react/index.ts" }
];

rmSync("dist", { recursive: true, force: true });

const common = {
  bundle: true,
  target: "es2020",
  minify: true,
  sourcemap: true,
  external: ["react"],
  legalComments: "none"
};

for (const { name, entry } of entries) {
  await build({
    ...common,
    entryPoints: [entry],
    format: "esm",
    outfile: `dist/${name}.js`,
    platform: "neutral"
  });

  await build({
    ...common,
    entryPoints: [entry],
    format: "cjs",
    outfile: `dist/${name}.cjs`,
    platform: "node"
  });
}

writeFileSync(
  "dist/index.js",
  ['export * from "./core/index.js";', 'export * from "./react/index.js";', ""].join("\n"),
  "utf8"
);

writeFileSync(
  "dist/index.cjs",
  [
    '"use strict";',
    "module.exports = {",
    '  ...require("./core/index.cjs"),',
    '  ...require("./react/index.cjs")',
    "};",
    ""
  ].join("\n"),
  "utf8"
);
