import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const PACKAGES = [
  "packages/core/package.json",
  "packages/react/package.json",
  "packages/devtools-bridge/package.json"
] as const;

type PackageJson = {
  name: string;
  version: string;
};

const readJson = (filePath: string): PackageJson => {
  return JSON.parse(readFileSync(filePath, "utf8")) as PackageJson;
};

const parseMajor = (version: string): number => {
  const match = /^(\d+)\./.exec(version);
  if (!match) {
    throw new Error(`Invalid semver version: ${version}`);
  }
  const majorText = match[1];
  if (majorText === undefined) {
    throw new Error(`Invalid semver version: ${version}`);
  }
  return Number.parseInt(majorText, 10);
};

const main = (): void => {
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
};

main();
