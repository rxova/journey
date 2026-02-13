import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const distDir = process.argv[2] ?? "dist";
const dtsPath = join(distDir, "index.d.ts");
const dctsPath = join(distDir, "index.d.cts");
const dtsMapPath = join(distDir, "index.d.ts.map");
const dctsMapPath = join(distDir, "index.d.cts.map");

if (!existsSync(dtsPath)) {
  console.warn(`[copy-types] Missing ${dtsPath}, skipping .d.cts generation.`);
  process.exit(0);
}

const dts = readFileSync(dtsPath, "utf8");
const dcts = dts.replace(
  /\/\/# sourceMappingURL=index\.d\.ts\.map/g,
  "//# sourceMappingURL=index.d.cts.map"
);

writeFileSync(dctsPath, dcts, "utf8");

if (existsSync(dtsMapPath)) {
  const map = JSON.parse(readFileSync(dtsMapPath, "utf8"));
  map.file = "index.d.cts";
  writeFileSync(dctsMapPath, JSON.stringify(map), "utf8");
}
