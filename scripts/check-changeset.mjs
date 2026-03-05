import { execSync } from "node:child_process";
import process from "node:process";

function getEnv(name, required = true) {
  const value = process.env[name];
  if (!value && required) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

function run(cmd) {
  return execSync(cmd, { encoding: "utf8" }).trim();
}

function getChangedFiles(baseSha, headSha) {
  const output = run(`git diff --name-only ${baseSha} ${headSha}`);
  if (!output) return [];
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function hasChangeset(files) {
  return files.some((file) => file.startsWith(".changeset/") && file.endsWith(".md"));
}

function isDocsOrConfigOnly(files) {
  const allowedPattern = /^(docs\/|\.github\/|\.changeset\/|.*\.(md|txt|yml|yaml|json))$/;
  const touchesPackage = files.some(
    (file) =>
      file.startsWith("packages/core/") ||
      file.startsWith("packages/react/") ||
      file.startsWith("packages/devtools-bridge/")
  );

  return files.length > 0 && files.every((file) => allowedPattern.test(file)) && !touchesPackage;
}

function getLabels(repo, prNumber, token) {
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
    console.warn("Warning: failed to fetch labels via GH API, proceeding without labels.");
    return [];
  }
}

function main() {
  const baseSha = getEnv("BASE_SHA");
  const headSha = getEnv("HEAD_SHA");
  const repo = getEnv("GITHUB_REPOSITORY");
  const prNumber = getEnv("PR_NUMBER");
  const prTitle = getEnv("PR_TITLE", false) ?? "";
  const ghToken = getEnv("GH_TOKEN", false) ?? "";

  const files = getChangedFiles(baseSha, headSha);

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

  if (isDocsOrConfigOnly(files)) {
    console.log("Docs/CI/config-only changes detected; skipping changeset check.");
    return;
  }

  if (hasChangeset(files)) {
    console.log("Changeset found.");
    return;
  }

  console.error(
    "No changeset found. Add one with 'pnpm changeset' or apply the 'skip-changeset' label."
  );
  process.exit(1);
}

main();
