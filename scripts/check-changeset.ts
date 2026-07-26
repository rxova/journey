import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

/**
 * PR gate: fails when a change to a published package lands without a
 * changeset. Escape hatches: the `skip-changeset` label, `[skip-changeset]`
 * in the PR title, or a diff that only touches docs/CI/config.
 *
 * Shared, near-verbatim, across the four rxova repos. Keep the differences to
 * the two constants below so the copies stay diffable — this is one of the
 * files earmarked for @rxova/repo-tooling. Its behaviour is pinned by
 * check-changeset.test.ts, which spawns it against a throwaway git repo.
 */

/** Directory prefixes of packages that are published to npm. */
const publishedPackageDirs = ["packages/core/", "packages/react/", "packages/devtools-bridge/"];

/**
 * Files that never require a changeset when they are the whole diff.
 *
 * The directory alternatives carry a `/.*` suffix on purpose. An earlier
 * version wrote them as `^(docs\/|\.github\/|…)$`, where the `$` meant each
 * branch could only ever match the bare directory string — never a path
 * beneath it — so those prefixes were dead and files were only skipped when
 * they happened to carry one of the listed extensions.
 */
const allowedPattern =
  /^((apps|examples|\.github|\.changeset|\.husky|scripts)\/.*|.*\.(md|txt|yml|yaml|json))$/;

const getEnv = (name: string, required = true): string | undefined => {
  const value = process.env[name];
  if (!value && required) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
};

const run = (cmd: string): string => {
  return execSync(cmd, { encoding: "utf8" }).trim();
};

const getChangedFiles = (baseSha: string, headSha: string, diffFilter?: string): string[] => {
  const filterArg = diffFilter ? ` --diff-filter=${diffFilter}` : "";
  const output = run(`git diff --name-only${filterArg} ${baseSha} ${headSha}`);
  if (!output) return [];
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
};

const getChangesetFiles = (files: readonly string[]): string[] => {
  return files.filter(
    (file) =>
      file.startsWith(".changeset/") && file.endsWith(".md") && path.basename(file) !== "README.md"
  );
};

const extractFrontmatterPackageCount = (markdown: string): number => {
  const match = /^---\s*\n([\s\S]*?)\n---\s*(?:\n|$)/.exec(markdown);
  if (!match) {
    return 0;
  }

  const frontmatter = match[1] ?? "";
  const packageLines = frontmatter
    .split("\n")
    .map((line) => line.trim())
    // Both quote styles: `changeset add` writes double quotes, but Prettier
    // with singleQuote rewrites them, and a double-quote-only pattern then
    // counts zero packages and fails a perfectly valid changeset.
    .filter((line) => /^("[^"]+"|'[^']+')\s*:\s*(patch|minor|major)(?:\s+#.*)?$/.test(line));

  return packageLines.length;
};

const ensureSinglePackagePerChangeset = (files: readonly string[]): void => {
  const errors: string[] = [];

  for (const file of files) {
    let content: string;
    try {
      content = readFileSync(file, "utf8");
    } catch {
      errors.push(`- ${file}: could not be read`);
      continue;
    }

    const packageCount = extractFrontmatterPackageCount(content);
    if (packageCount !== 1) {
      errors.push(`- ${file}: expected exactly 1 package, found ${String(packageCount)}`);
    }
  }

  if (errors.length > 0) {
    console.error("Invalid changeset format. Use one changeset file per package.");
    console.error(errors.join("\n"));
    process.exit(1);
  }
};

const isDocsOrConfigOnly = (files: readonly string[]): boolean => {
  const touchesPackage = files.some((file) =>
    publishedPackageDirs.some((dir) => file.startsWith(dir))
  );

  return files.length > 0 && files.every((file) => allowedPattern.test(file)) && !touchesPackage;
};

const getLabels = (repo: string, prNumber: string, token: string): string[] => {
  try {
    const output = run(
      `gh api -H "Authorization: Bearer ${token}" repos/${repo}/issues/${prNumber}/labels --jq '.[].name'`
    );
    if (!output) return [];
    return output
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    // Deliberately not fatal: a transient API blip should not block a PR. Note
    // that a *permissions* problem looks the same from here, so the changeset
    // job must grant `pull-requests: read` or the label hatch silently no-ops.
    console.warn("Warning: failed to fetch labels via GH API, proceeding without labels.");
    return [];
  }
};

const main = (): void => {
  const baseSha = getEnv("BASE_SHA");
  const headSha = getEnv("HEAD_SHA");
  const repo = getEnv("GITHUB_REPOSITORY");
  const prNumber = getEnv("PR_NUMBER");
  const prTitle = getEnv("PR_TITLE", false) ?? "";
  const ghToken = getEnv("GH_TOKEN", false) ?? "";

  if (!baseSha || !headSha || !repo || !prNumber) {
    throw new Error("Missing required environment for changeset check.");
  }

  const files = getChangedFiles(baseSha, headSha);
  // A second diff excluding deletions: a PR that *removes* a changeset must not
  // count that removal as "a changeset is present".
  const currentFiles = getChangedFiles(baseSha, headSha, "ACMRTUXB");
  const currentChangesetFiles = getChangesetFiles(currentFiles);

  if (ghToken) {
    const labels = getLabels(repo, prNumber, ghToken);
    if (labels.includes("skip-changeset")) {
      console.log("skip-changeset label present; skipping changeset check.");
      return;
    }
  }

  if (prTitle.includes("[skip-changeset]")) {
    console.log("[skip-changeset] found in PR title; skipping changeset check.");
    return;
  }

  if (currentChangesetFiles.length > 0) {
    ensureSinglePackagePerChangeset(currentChangesetFiles);
    console.log("Changeset found.");
    return;
  }

  if (isDocsOrConfigOnly(files)) {
    console.log("Docs/CI/config-only changes detected; skipping changeset check.");
    return;
  }

  console.error(
    "No changeset found. Add one with 'pnpm exec changeset' or apply the 'skip-changeset' label."
  );
  process.exit(1);
};

main();
