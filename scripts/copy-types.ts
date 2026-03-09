import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const distDir = process.argv[2] ?? "dist";
const declarationFiles = readdirSync(distDir).filter(
  (file) => file.endsWith(".d.ts") && !file.endsWith(".d.cts")
);

if (declarationFiles.length === 0) {
  console.warn(`[copy-types] No .d.ts files found in ${distDir}, skipping .d.cts generation.`);
  process.exit(0);
}

for (const declarationFile of declarationFiles) {
  const dtsPath = join(distDir, declarationFile);
  const baseName = declarationFile.replace(/\.d\.ts$/, "");
  const dctsFile = `${baseName}.d.cts`;
  const dtsMapFile = `${declarationFile}.map`;
  const dctsMapFile = `${dctsFile}.map`;
  const dctsPath = join(distDir, dctsFile);
  const dtsMapPath = join(distDir, dtsMapFile);
  const dctsMapPath = join(distDir, dctsMapFile);

  if (!existsSync(dtsPath)) {
    console.warn(`[copy-types] Missing ${dtsPath}, skipping .d.cts generation.`);
    continue;
  }

  const dts = readFileSync(dtsPath, "utf8");
  const dcts = dts.replace(
    new RegExp(`//# sourceMappingURL=${declarationFile.replace(/\./g, "\\.")}\\.map`, "g"),
    `//# sourceMappingURL=${dctsMapFile}`
  );

  writeFileSync(dctsPath, dcts, "utf8");

  if (existsSync(dtsMapPath)) {
    const map = JSON.parse(readFileSync(dtsMapPath, "utf8"));
    map.file = dctsFile;
    writeFileSync(dctsMapPath, JSON.stringify(map), "utf8");
  }
}
