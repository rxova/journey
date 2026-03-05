import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const RELEASE_PACKAGES = [
  "packages/core/package.json",
  "packages/react/package.json",
  "packages/devtools-bridge/package.json"
];
const CORE_PACKAGE_PATH = "packages/core/package.json";

export function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

export function parseVersion(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-.]+))?$/.exec(version);
  if (!match) {
    throw new Error(`Invalid semver version: ${version}`);
  }

  const prerelease = match[4]
    ? match[4].split(".").map((part) => (/^\d+$/.test(part) ? Number.parseInt(part, 10) : part))
    : [];

  return {
    major: Number.parseInt(match[1], 10),
    minor: Number.parseInt(match[2], 10),
    patch: Number.parseInt(match[3], 10),
    prerelease
  };
}

export function syncRootVersion(repoRoot, { log = console.log } = {}) {
  const rootPackagePath = path.join(repoRoot, "package.json");
  const rootPackageJson = readJson(rootPackagePath);
  const corePackageVersion = readJson(path.join(repoRoot, CORE_PACKAGE_PATH)).version;
  const packageVersions = RELEASE_PACKAGES.map(
    (packagePath) => readJson(path.join(repoRoot, packagePath)).version
  );
  const targetVersion = corePackageVersion;

  // Keep parsing all release package versions so invalid semver is caught early.
  for (const version of packageVersions) {
    parseVersion(version);
  }

  if (rootPackageJson.version === targetVersion) {
    log(`Root package version already matches core: ${targetVersion}`);
    return { updated: false, targetVersion };
  }

  rootPackageJson.version = targetVersion;
  writeFileSync(rootPackagePath, `${JSON.stringify(rootPackageJson, null, 2)}\n`, "utf8");
  log(`Updated root package version to match core: ${targetVersion}`);
  return { updated: true, targetVersion };
}

export function runChangesetVersion({
  runner = execFileSync,
  cwd = process.cwd(),
  stdio = "inherit"
} = {}) {
  runner("pnpm", ["exec", "changeset", "version"], { cwd, stdio });
}

export function main({
  repoRoot = process.cwd(),
  runChangesetVersionFn = runChangesetVersion,
  syncRootVersionFn = syncRootVersion
} = {}) {
  runChangesetVersionFn({ cwd: repoRoot, stdio: "inherit" });
  return syncRootVersionFn(repoRoot);
}

export function isEntrypoint(entryArg = process.argv[1], moduleUrl = import.meta.url) {
  if (!entryArg) return false;
  return pathToFileURL(entryArg).href === moduleUrl;
}

/* c8 ignore next 3 */
if (isEntrypoint()) {
  main();
}
