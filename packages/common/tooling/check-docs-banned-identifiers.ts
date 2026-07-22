import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const defaultRepoRoot = process.cwd();

/** Hand-written docs root, relative to the repo root. */
export const DOCS_ROOT = "apps/docs/docs";

export type BannedIdentifier = {
  name: string;
  pattern: RegExp;
};

export type BannedIdentifierMatch = {
  /** Path relative to the repo root, POSIX-separated. */
  file: string;
  line: number;
  identifier: string;
};

type LogFn = (message: string) => void;
type ExitFn = (code: number) => void;

/**
 * Identifiers from the pre-1.0 (rc-era) API that must not appear in current
 * hand-written docs. Word boundaries keep current names safe: for example,
 * `createGraphJourneyBuilder` does not match `createJourneyBuilder`, and
 * `JourneyProvider` does not match inside a longer identifier.
 */
export const BANNED_IDENTIFIERS: readonly BannedIdentifier[] = [
  { name: "createJourneyMachine", pattern: /\bcreateJourneyMachine\b/ },
  { name: "createHeadlessJourney", pattern: /\bcreateHeadlessJourney\b/ },
  { name: "createJourneyBuilder", pattern: /\bcreateJourneyBuilder\b/ },
  { name: "createJourneyFactory", pattern: /\bcreateJourneyFactory\b/ },
  { name: "updateStepMetadata", pattern: /\bupdateStepMetadata\b/ },
  { name: "machine.subscribeStart", pattern: /\bmachine\.subscribeStart\b/ },
  { name: "useJourneyApi", pattern: /\buseJourneyApi\b/ },
  { name: "useStepApi", pattern: /\buseStepApi\b/ },
  { name: "useJourneyComputed", pattern: /\buseJourneyComputed\b/ },
  { name: "JourneyProvider", pattern: /\bJourneyProvider\b/ },
  { name: "commandsEnabled", pattern: /\bcommandsEnabled\b/ },
  // Linear tier surfaces removed by the definition-taking factory (2026-07).
  { name: "<LinearJourney>", pattern: /<LinearJourney[\s/>]/ },
  { name: "LinearJourney.Step", pattern: /\bLinearJourney\.Step\b/ },
  { name: "useLinearJourney", pattern: /\buseLinearJourney\b/ },
  { name: "useLinearJourneySelector", pattern: /\buseLinearJourneySelector\b/ },
  { name: "useLinearJourneyStep", pattern: /\buseLinearJourneyStep\b/ },
  { name: "TypedLinearJourney", pattern: /\bTypedLinearJourney\b/ },
  { name: "LinearJourneyProps", pattern: /\bLinearJourneyProps\b/ },
  { name: "LinearJourneyStepConfig", pattern: /\bLinearJourneyStepConfig\b/ },
  { name: "LinearJourneyStepProps", pattern: /\bLinearJourneyStepProps\b/ },
  { name: "bundle.toGraphDefinition", pattern: /\btoGraphDefinition\b/ },
  // Graph bundle surfaces removed by the standalone-machine redesign (2026-07).
  { name: "useApi", pattern: /\buseApi\b/ },
  { name: "useEvent", pattern: /\buseEvent\b/ },
  { name: "useStepLifecycle", pattern: /\buseStepLifecycle\b/ },
  // Removed with the headless entry point and the standalone linear bundle
  // (2026-07). useJourneySnapshot/useJourneySelector/useJourneyEvent are NOT
  // banned: they survive as conventional local-helper names in the documented
  // bring-your-own-machine pattern.
  { name: "journey-react/headless", pattern: /journey-react\/headless/ },
  { name: "useOwnedJourney", pattern: /\buseOwnedJourney\b/ },
  { name: "useJourneyStepLifecycle", pattern: /\buseJourneyStepLifecycle\b/ },
  { name: "useStepAsyncState", pattern: /\buseStepAsyncState\b/ },
  // `useJourney` is deliberately NOT banned: the rc-era hook of that name was
  // removed, but the name was then reused for the current per-component
  // ownership hook. Banning it kept the shipping API out of the hand-written
  // docs entirely — it survived only in the generated reference, which this
  // check excludes.
  { name: "UseLinearJourneyResult", pattern: /\bUseLinearJourneyResult\b/ },
  { name: "machineRef", pattern: /\bmachineRef\b/ }
];

/**
 * Files where rc-era identifiers are legitimate: the migration guide teaches
 * the old-to-new mapping, and release-notes pages are auto-generated history
 * synced from package changelogs.
 */
export const isAllowlistedFile = (docsRelativePath: string): boolean => {
  const normalized = docsRelativePath.replace(/\\/g, "/");
  if (normalized === "core/pre-1-0-migration.md") return true;
  return path.posix.basename(normalized) === "releases.md";
};

/** Generated TypeDoc trees and cut doc versions are outside this check's scope. */
export const isExcludedPath = (docsRelativePath: string): boolean => {
  const normalized = docsRelativePath.replace(/\\/g, "/");
  return (
    normalized.split("/").includes("versioned_docs") || /(^|\/)api\/reference\//.test(normalized)
  );
};

const isDocFile = (fileName: string): boolean => {
  return fileName.endsWith(".md") || fileName.endsWith(".mdx");
};

/**
 * READMEs are shipped documentation too — each package README is published to
 * npm, and the root README is the repository landing page — but they sat
 * outside this check while it only walked the docs site. That is exactly how a
 * whole section documenting the deleted `journey-react/headless` entry point
 * survived in the root README: the identifiers were already banned here, the
 * file just was never scanned.
 */
export const collectReadmeFiles = (repoRoot: string): string[] => {
  const files = existsSync(path.join(repoRoot, "README.md")) ? ["README.md"] : [];
  const packagesDir = path.join(repoRoot, "packages");
  if (!existsSync(packagesDir)) return files;

  for (const entry of readdirSync(packagesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const relativePath = path.posix.join("packages", entry.name, "README.md");
    if (existsSync(path.join(repoRoot, relativePath))) files.push(relativePath);
  }

  return files.sort();
};

/** Recursively collects scannable doc files, as paths relative to `docsRoot`. */
export const collectDocsFiles = (docsRoot: string, relativeDir = ""): string[] => {
  const absoluteDir = path.join(docsRoot, relativeDir);
  const entries = readdirSync(absoluteDir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const relativePath = relativeDir ? path.posix.join(relativeDir, entry.name) : entry.name;
    if (entry.isDirectory()) {
      if (isExcludedPath(`${relativePath}/`)) continue;
      files.push(...collectDocsFiles(docsRoot, relativePath));
      continue;
    }
    if (!entry.isFile() || !isDocFile(entry.name)) continue;
    if (isExcludedPath(relativePath) || isAllowlistedFile(relativePath)) continue;
    files.push(relativePath);
  }

  return files.sort();
};

export const scanContent = (content: string): { line: number; identifier: string }[] => {
  const matches: { line: number; identifier: string }[] = [];
  const lines = content.split("\n");

  lines.forEach((lineText, index) => {
    for (const banned of BANNED_IDENTIFIERS) {
      if (banned.pattern.test(lineText)) {
        matches.push({ line: index + 1, identifier: banned.name });
      }
    }
  });

  return matches;
};

type CheckDocsBannedIdentifiersOptions = {
  repoRoot?: string;
  log?: LogFn;
  error?: LogFn;
  exit?: ExitFn;
};

export const checkDocsBannedIdentifiers = ({
  repoRoot = defaultRepoRoot,
  log = console.log,
  error = console.error,
  exit = (code) => process.exit(code)
}: CheckDocsBannedIdentifiersOptions = {}): { matches: BannedIdentifierMatch[] } => {
  const docsRoot = path.join(repoRoot, DOCS_ROOT);
  const docsFiles = collectDocsFiles(docsRoot).map((relativePath) => ({
    absolute: path.join(docsRoot, relativePath),
    display: path.posix.join(DOCS_ROOT, relativePath)
  }));
  const readmeFiles = collectReadmeFiles(repoRoot).map((relativePath) => ({
    absolute: path.join(repoRoot, relativePath),
    display: relativePath
  }));
  const files = [...docsFiles, ...readmeFiles];

  const matches: BannedIdentifierMatch[] = files.flatMap(({ absolute, display }) => {
    const content = readFileSync(absolute, "utf8");
    return scanContent(content).map(({ line, identifier }) => ({
      file: display,
      line,
      identifier
    }));
  });

  if (matches.length > 0) {
    error("Banned pre-1.0 identifiers found in hand-written docs:");
    for (const match of matches) {
      error(`- ${match.file}:${match.line} (${match.identifier})`);
    }
    error(
      "Rewrite these references against the current API, or move legitimately historical content into the migration guide or release notes."
    );
    exit(1);
    return { matches };
  }

  log(`Docs are free of banned pre-1.0 identifiers (${files.length} files scanned).`);
  return { matches };
};

export const main = (
  options: CheckDocsBannedIdentifiersOptions = {}
): { matches: BannedIdentifierMatch[] } => {
  return checkDocsBannedIdentifiers(options);
};

export const isEntrypoint = (
  entryArg: string | undefined = process.argv[1],
  moduleUrl = import.meta.url
): boolean => {
  if (!entryArg) return false;
  return pathToFileURL(entryArg).href === moduleUrl;
};

/* c8 ignore next 3 */
if (isEntrypoint()) {
  main();
}
