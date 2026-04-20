import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultRepoRoot = path.resolve(__dirname, "../../..");

type LogFn = (message: string) => void;
type ErrorFn = (message: string) => void;
type ExitFn = (code: number) => void;

type JsonRecord = Record<string, unknown>;

type VersionLabelSource = {
  pluginId: string;
  source: string;
};

type SyncDocVersionLabelsOptions = {
  repoRoot?: string;
  sources?: readonly VersionLabelSource[];
  target?: string;
  log?: LogFn;
};

type CheckDocVersionLabelsOptions = {
  repoRoot?: string;
  sources?: readonly VersionLabelSource[];
  target?: string;
  log?: LogFn;
  error?: ErrorFn;
  exit?: ExitFn;
};

type MainOptions = {
  argv?: string[];
  repoRoot?: string;
  sources?: readonly VersionLabelSource[];
  target?: string;
  log?: LogFn;
  error?: ErrorFn;
  exit?: ExitFn;
};

type SyncDocVersionLabelsResult = {
  updated: boolean;
  target: string;
};

type CheckDocVersionLabelsResult = {
  stale: boolean;
  target: string;
};

type MainResult = {
  updated?: boolean;
  stale?: boolean;
  target: string;
};

const defaultExit: ExitFn = (code) => {
  process.exit(code);
};

export const versionLabelSources: readonly VersionLabelSource[] = [
  { pluginId: "core", source: "packages/core/package.json" },
  { pluginId: "react", source: "packages/react/package.json" },
  { pluginId: "bridge", source: "packages/devtools-bridge/package.json" },
  { pluginId: "chrome-devtools", source: "apps/devtools/package.json" }
];

export const versionLabelsTarget = "apps/docs/version-labels.json";

export function toRepoPath(repoRoot: string, ...parts: string[]): string {
  return path.join(repoRoot, ...parts);
}

export function readUtf8(filePath: string): string {
  return readFileSync(filePath, "utf8").replace(/\r\n/g, "\n");
}

export function readJson<T extends JsonRecord = JsonRecord>(filePath: string): T {
  return JSON.parse(readUtf8(filePath)) as T;
}

export function assertSemver(version: string, context: string): void {
  const semverPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z-.]+)?$/;
  if (!semverPattern.test(version)) {
    throw new Error(`Invalid semver version "${version}" for ${context}`);
  }
}

export function buildVersionLabels(
  repoRoot = defaultRepoRoot,
  sources: readonly VersionLabelSource[] = versionLabelSources
): Record<string, string> {
  const labels: Record<string, string> = {};

  for (const entry of sources) {
    const sourcePath = toRepoPath(repoRoot, entry.source);
    const pkg = readJson<{ version?: unknown }>(sourcePath);
    const version = pkg.version;

    if (typeof version !== "string" || version.trim() === "") {
      throw new Error(`Missing "version" in ${entry.source}`);
    }

    assertSemver(version, entry.source);
    labels[entry.pluginId] = version;
  }

  return labels;
}

export function expectedContent(
  repoRoot = defaultRepoRoot,
  sources: readonly VersionLabelSource[] = versionLabelSources
): string {
  const labels = buildVersionLabels(repoRoot, sources);
  return `${JSON.stringify(labels, null, 2)}\n`;
}

export function writeIfChanged(filePath: string, content: string): boolean {
  let current: string | undefined;
  try {
    current = readUtf8(filePath);
  } catch {
    // File does not exist yet.
  }

  if (current === content) {
    return false;
  }

  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, "utf8");
  return true;
}

export function checkMatches(filePath: string, content: string): boolean {
  let current: string;
  try {
    current = readUtf8(filePath);
  } catch {
    return false;
  }
  return current === content;
}

export function syncDocVersionLabels({
  repoRoot = defaultRepoRoot,
  sources = versionLabelSources,
  target = versionLabelsTarget,
  log = console.log
}: SyncDocVersionLabelsOptions = {}): SyncDocVersionLabelsResult {
  const targetPath = toRepoPath(repoRoot, target);
  const content = expectedContent(repoRoot, sources);

  if (!writeIfChanged(targetPath, content)) {
    log("Doc version labels are already up to date.");
    return { updated: false, target };
  }

  log(`Updated ${target}`);
  return { updated: true, target };
}

export function checkDocVersionLabels({
  repoRoot = defaultRepoRoot,
  sources = versionLabelSources,
  target = versionLabelsTarget,
  log = console.log,
  error = console.error,
  exit = defaultExit
}: CheckDocVersionLabelsOptions = {}): CheckDocVersionLabelsResult {
  const targetPath = toRepoPath(repoRoot, target);
  const content = expectedContent(repoRoot, sources);

  if (!checkMatches(targetPath, content)) {
    error("Doc version labels are out of date. Run: pnpm run docs:version-labels:sync");
    error(`- ${target}`);
    exit(1);
    return { stale: true, target };
  }

  log("Doc version labels are up to date.");
  return { stale: false, target };
}

export function main({
  argv = process.argv,
  repoRoot = defaultRepoRoot,
  sources = versionLabelSources,
  target = versionLabelsTarget,
  log = console.log,
  error = console.error,
  exit = defaultExit
}: MainOptions = {}): MainResult {
  if (argv.includes("--check")) {
    return checkDocVersionLabels({ repoRoot, sources, target, log, error, exit });
  }

  return syncDocVersionLabels({ repoRoot, sources, target, log });
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
