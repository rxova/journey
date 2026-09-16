import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const defaultRepoRoot = process.cwd();

/** Changeset directory, relative to the repo root. */
export const CHANGESET_ROOT = ".changeset";

export type OverridePattern = {
  name: string;
  pattern: RegExp;
};

export type OverrideMatch = {
  /** Path relative to the repo root, POSIX-separated. */
  file: string;
  /** 1-based line number in the whole file, frontmatter included. */
  line: number;
  override: string;
  text: string;
};

type LogFn = (message: string) => void;
type ExitFn = (code: number) => void;

/**
 * Line shapes `@changesets/changelog-github` treats as changelog metadata
 * overrides rather than as prose.
 *
 * Its `getReleaseLine` runs these against the whole changeset summary before
 * rendering, strips whatever matches, and substitutes the captured value. A
 * `commit:` line is the dangerous one: the captured text is interpolated into a
 * GraphQL alias (`commit__${value}`) by `@changesets/get-github-info`, so a
 * summary containing a TypeScript snippet whose `commit` property starts a line
 * yields `commit__({` and the release job dies on `Expected NAME, actual:
 * LCURLY`. That is not a hypothetical: it took the Release workflow down on
 * main, and the changeset that did it had passed every other gate in this repo.
 *
 * Mirrors the upstream regexes deliberately, flags included — they are
 * case-insensitive and anchored per line, so `Commit:` at column zero counts
 * and an indented one inside a fenced code block counts too. Upstream does not
 * know what a code fence is, so neither does this check.
 */
export const OVERRIDE_PATTERNS: readonly OverridePattern[] = [
  { name: "commit:", pattern: /^\s*commit:\s*[^\s]+/i },
  { name: "pr: / pull: / pull request:", pattern: /^\s*(?:pr|pull|pull\s+request):\s*#?\d+/i },
  { name: "author: / user:", pattern: /^\s*(?:author|user):\s*@?[^\s]+/i }
];

/**
 * `README.md` documents the directory for humans and is never read as a
 * changeset, so its prose is out of scope.
 */
export const isChangesetFile = (fileName: string): boolean =>
  fileName.endsWith(".md") && fileName !== "README.md";

/**
 * Splits off the YAML frontmatter, returning the summary and the line offset it
 * starts at. Only the summary reaches `getReleaseLine`; the frontmatter is
 * parsed as YAML, where `"@rxova/journey-core": minor` is a release bump and not
 * prose. Reporting against the original line numbers keeps the error message
 * copy-pasteable into an editor.
 */
export const splitFrontmatter = (content: string): { summary: string; firstLine: number } => {
  const lines = content.split("\n");
  if (lines[0]?.trim() !== "---") return { summary: content, firstLine: 1 };

  const closing = lines.indexOf("---", 1);
  if (closing === -1) return { summary: content, firstLine: 1 };

  return { summary: lines.slice(closing + 1).join("\n"), firstLine: closing + 2 };
};

export const scanContent = (
  content: string
): { line: number; override: string; text: string }[] => {
  const { summary, firstLine } = splitFrontmatter(content);
  const matches: { line: number; override: string; text: string }[] = [];

  summary.split("\n").forEach((lineText, index) => {
    for (const { name, pattern } of OVERRIDE_PATTERNS) {
      if (pattern.test(lineText)) {
        matches.push({ line: firstLine + index, override: name, text: lineText.trim() });
      }
    }
  });

  return matches;
};

/** Collects changeset files, as paths relative to `changesetRoot`. */
export const collectChangesetFiles = (changesetRoot: string): string[] => {
  if (!existsSync(changesetRoot)) return [];

  return readdirSync(changesetRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile() && isChangesetFile(entry.name))
    .map((entry) => entry.name)
    .sort();
};

type CheckChangesetOverridesOptions = {
  repoRoot?: string;
  log?: LogFn;
  error?: LogFn;
  exit?: ExitFn;
};

export const checkChangesetOverrides = ({
  repoRoot = defaultRepoRoot,
  log = console.log,
  error = console.error,
  exit = (code) => process.exit(code)
}: CheckChangesetOverridesOptions = {}): { matches: OverrideMatch[] } => {
  const changesetRoot = path.join(repoRoot, CHANGESET_ROOT);
  const files = collectChangesetFiles(changesetRoot);

  const matches: OverrideMatch[] = files.flatMap((fileName) => {
    const content = readFileSync(path.join(changesetRoot, fileName), "utf8");
    return scanContent(content).map(({ line, override, text }) => ({
      file: path.posix.join(CHANGESET_ROOT, fileName),
      line,
      override,
      text
    }));
  });

  if (matches.length > 0) {
    error("Changelog metadata overrides found in changeset summaries:");
    for (const match of matches) {
      error(`- ${match.file}:${match.line} (${match.override}) ${match.text}`);
    }
    error(
      "@changesets/changelog-github reads these as metadata, not prose, and a `commit:` line fails the release with an invalid GraphQL alias. Keep the keyword off the start of a line — in a code fence, prefix it with an inline comment and mark the fence `<!-- prettier-ignore -->` so the formatter cannot undo it."
    );
    exit(1);
    return { matches };
  }

  log(`Changeset summaries are free of changelog metadata overrides (${files.length} scanned).`);
  return { matches };
};

export const main = (
  options: CheckChangesetOverridesOptions = {}
): { matches: OverrideMatch[] } => {
  return checkChangesetOverrides(options);
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
