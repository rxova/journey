import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";

const collectDtsFiles = (dir: string): string[] => {
  const results: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectDtsFiles(fullPath));
    } else if (entry.name.endsWith(".d.ts")) {
      results.push(fullPath);
    }
  }
  return results;
};

const distDir = process.argv[2] ?? "dist";
const entryTypeFiles = collectDtsFiles(distDir);

if (entryTypeFiles.length === 0) {
  console.warn(`[copy-types] Missing declaration files in ${distDir}, skipping .d.cts generation.`);
  process.exit(0);
}

for (const dtsPath of entryTypeFiles) {
  const name = basename(dtsPath, ".d.ts");
  const dctsPath = join(dirname(dtsPath), `${name}.d.cts`);
  const dtsMapPath = join(dirname(dtsPath), `${name}.d.ts.map`);
  const dctsMapPath = join(dirname(dtsPath), `${name}.d.cts.map`);
  const dts = readFileSync(dtsPath, "utf8");
  const dtsSourceMapComment = `//# sourceMappingURL=${name}.d.ts.map`;
  const dctsSourceMapComment = `//# sourceMappingURL=${name}.d.cts.map`;
  const dcts = dts.split(dtsSourceMapComment).join(dctsSourceMapComment);

  writeFileSync(dctsPath, dcts, "utf8");

  if (existsSync(dtsMapPath)) {
    const map = JSON.parse(readFileSync(dtsMapPath, "utf8"));
    map.file = `${name}.d.cts`;
    writeFileSync(dctsMapPath, JSON.stringify(map), "utf8");
  }
}
