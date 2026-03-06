import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const PACKAGES = [
  "packages/core/package.json",
  "packages/react/package.json",
  "packages/devtools-bridge/package.json"
];

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function parseMajor(version) {
  const match = /^(\d+)\./.exec(version);
  if (!match) {
    throw new Error(`Invalid semver version: ${version}`);
  }
  return Number.parseInt(match[1], 10);
}

function main() {
  const repoRoot = process.cwd();
  const entries = PACKAGES.map((relativePath) => {
    const packageJsonPath = path.join(repoRoot, relativePath);
    const packageJson = readJson(packageJsonPath);
    return {
      name: packageJson.name,
      version: packageJson.version,
      major: parseMajor(packageJson.version),
      packageJsonPath
    };
  });

  const majors = new Set(entries.map((entry) => entry.major));
  if (majors.size > 1) {
    const details = entries
      .map((entry) => `${entry.name}@${entry.version} (${entry.packageJsonPath})`)
      .join("\n");
    throw new Error(`Core/React/Bridge major versions must match.\n${details}`);
  }

  const major = entries[0]?.major ?? 0;
  console.log(`Major version policy OK: core/react/bridge are on major ${major}.`);
}

main();
