import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultRepoRoot = path.resolve(__dirname, "..");

export const versionLabelSources = [
  { pluginId: "core", source: "packages/core/package.json" },
  { pluginId: "react", source: "packages/react/package.json" },
  { pluginId: "bridge", source: "packages/devtools-bridge/package.json" },
  { pluginId: "chrome-devtools", source: "apps/devtools/package.json" }
];

export const versionLabelsTarget = "apps/docs/version-labels.json";

export function toRepoPath(repoRoot, ...parts) {
  return path.join(repoRoot, ...parts);
}

export function readUtf8(filePath) {
  return readFileSync(filePath, "utf8").replace(/\r\n/g, "\n");
}

export function readJson(filePath) {
  return JSON.parse(readUtf8(filePath));
}

export function assertSemver(version, context) {
  const semverPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z-.]+)?$/;
  if (!semverPattern.test(version)) {
    throw new Error(`Invalid semver version "${version}" for ${context}`);
  }
}

export function buildVersionLabels(repoRoot = defaultRepoRoot, sources = versionLabelSources) {
  const labels = {};

  for (const entry of sources) {
    const sourcePath = toRepoPath(repoRoot, entry.source);
    const pkg = readJson(sourcePath);
    const version = pkg?.version;

    if (typeof version !== "string" || version.trim() === "") {
      throw new Error(`Missing "version" in ${entry.source}`);
    }

    assertSemver(version, entry.source);
    labels[entry.pluginId] = version;
  }

  return labels;
}

export function expectedContent(repoRoot = defaultRepoRoot, sources = versionLabelSources) {
  const labels = buildVersionLabels(repoRoot, sources);
  return `${JSON.stringify(labels, null, 2)}\n`;
}

export function writeIfChanged(filePath, content) {
  let current;
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

export function checkMatches(filePath, content) {
  let current;
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
} = {}) {
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
  exit = (code) => process.exit(code)
} = {}) {
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
  exit = (code) => process.exit(code)
} = {}) {
  if (argv.includes("--check")) {
    return checkDocVersionLabels({ repoRoot, sources, target, log, error, exit });
  }

  return syncDocVersionLabels({ repoRoot, sources, target, log });
}

export function isEntrypoint(entryArg = process.argv[1], moduleUrl = import.meta.url) {
  if (!entryArg) return false;
  return pathToFileURL(entryArg).href === moduleUrl;
}

/* c8 ignore next 3 */
if (isEntrypoint()) {
  main();
}
