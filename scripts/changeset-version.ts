import { execFileSync } from "node:child_process";
import type { StdioOptions } from "node:child_process";
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

type JsonRecord = Record<string, unknown>;
type Logger = (message: string) => void;

type PackageJsonWithVersion = JsonRecord & {
  version: string;
};

export type ParsedVersion = {
  major: number;
  minor: number;
  patch: number;
  prerelease: Array<number | string>;
};

export type SyncRootVersionResult = {
  updated: boolean;
  targetVersion: string;
};

export type RunChangesetRunner = (
  file: string,
  args: readonly string[],
  options: { cwd: string; stdio: StdioOptions }
) => unknown;

export type RunChangesetVersionOptions = {
  runner?: RunChangesetRunner;
  cwd?: string;
  stdio?: StdioOptions;
};

export type SyncLockfileOptions = RunChangesetVersionOptions;

export type MainOptions = {
  repoRoot?: string;
  runChangesetVersionFn?: (options?: RunChangesetVersionOptions) => void;
  syncRootVersionFn?: (
    repoRoot: string,
    options?: {
      log?: Logger;
    }
  ) => SyncRootVersionResult;
  syncLockfileFn?: (options?: SyncLockfileOptions) => void;
};

export function readJson<T extends JsonRecord = JsonRecord>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

export function parseVersion(version: string): ParsedVersion {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-.]+))?$/.exec(version);
  if (!match) {
    throw new Error(`Invalid semver version: ${version}`);
  }

  const [, majorRaw, minorRaw, patchRaw, prereleaseRaw] = match;
  const prerelease = prereleaseRaw
    ? prereleaseRaw
        .split(".")
        .map((part): number | string => (/^\d+$/.test(part) ? Number.parseInt(part, 10) : part))
    : [];

  return {
    major: Number.parseInt(majorRaw!, 10),
    minor: Number.parseInt(minorRaw!, 10),
    patch: Number.parseInt(patchRaw!, 10),
    prerelease
  };
}

export function syncRootVersion(
  repoRoot: string,
  { log = console.log }: { log?: Logger } = {}
): SyncRootVersionResult {
  const rootPackagePath = path.join(repoRoot, "package.json");
  const rootPackageJson = readJson<PackageJsonWithVersion>(rootPackagePath);
  const corePackageVersion = readJson<PackageJsonWithVersion>(
    path.join(repoRoot, CORE_PACKAGE_PATH)
  ).version;
  const packageVersions = RELEASE_PACKAGES.map(
    (packagePath): string =>
      readJson<PackageJsonWithVersion>(path.join(repoRoot, packagePath)).version
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
}: RunChangesetVersionOptions = {}): void {
  runner("pnpm", ["exec", "changeset", "version"], { cwd, stdio });
}

/**
 * `changeset version` rewrites the `workspace:` ranges that the examples use to
 * depend on the published packages, which makes every one of those specifiers
 * stale in pnpm-lock.yaml. Nothing else in the release path regenerates it, so
 * without this the version commit lands a lockfile that disagrees with the
 * manifests it ships alongside and every `pnpm install --frozen-lockfile` in CI
 * fails on the merge:
 *
 *   ERR_PNPM_OUTDATED_LOCKFILE ... @rxova/journey-core
 *   (lockfile: workspace:1.0.0-rc.2, manifest: workspace:1.0.0-rc.3)
 *
 * That is what broke main on 1.0.0-rc.3 (#135). `--lockfile-only` is the whole
 * point: the release job has already installed, so this rewrites the lockfile
 * to match the freshly bumped manifests without touching node_modules.
 */
export function syncLockfile({
  runner = execFileSync,
  cwd = process.cwd(),
  stdio = "inherit"
}: SyncLockfileOptions = {}): void {
  runner("pnpm", ["install", "--lockfile-only"], { cwd, stdio });
}

export function main({
  repoRoot = process.cwd(),
  runChangesetVersionFn = runChangesetVersion,
  syncRootVersionFn = syncRootVersion,
  syncLockfileFn = syncLockfile
}: MainOptions = {}): SyncRootVersionResult {
  runChangesetVersionFn({ cwd: repoRoot, stdio: "inherit" });
  const result = syncRootVersionFn(repoRoot);
  // Last, so it picks up both the changeset bumps and the root sync above.
  syncLockfileFn({ cwd: repoRoot, stdio: "inherit" });
  return result;
}

export function isEntrypoint(
  entryArg: string | undefined = process.argv[1],
  moduleUrl: string = import.meta.url
): boolean {
  if (!entryArg) return false;
  return pathToFileURL(entryArg).href === moduleUrl;
}

/* c8 ignore next 3 */
if (isEntrypoint()) {
  main();
}
