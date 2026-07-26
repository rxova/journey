import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

/**
 * Spawns the real script against a throwaway git repo rather than importing it.
 * The script reads git and the environment and exits with a status; running it
 * for real is the only way to pin the behaviour CI actually depends on.
 */

const here = dirname(fileURLToPath(import.meta.url));
const scriptPath = resolve(here, "./check-changeset.ts");
const tsxLoaderPath = resolve(here, "../node_modules/tsx/dist/loader.mjs");

// GIT_* leaks from the outer repo (notably GIT_DIR under a hook) would point
// the child at the wrong repository.
const sanitizedEnv = Object.fromEntries(
  Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_"))
) as Record<string, string>;

const execGit = (cwd: string, args: string[]) =>
  execFileSync("git", args, { cwd, env: sanitizedEnv, stdio: "pipe", encoding: "utf8" }).trim();

const runScript = (cwd: string, env: Record<string, string>) => {
  try {
    const stdout = execFileSync(process.execPath, ["--import", tsxLoaderPath, scriptPath], {
      cwd,
      env: { ...sanitizedEnv, ...env },
      stdio: "pipe",
      encoding: "utf8"
    });
    return { code: 0, output: stdout };
  } catch (error) {
    const err = error as { status?: number; stdout?: Buffer; stderr?: Buffer };
    const output = [err.stdout?.toString(), err.stderr?.toString()]
      .filter((value): value is string => Boolean(value))
      .join("\n");
    return { code: err.status ?? 1, output };
  }
};

const tempRoots: string[] = [];

const initRepo = async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "check-changeset-"));
  tempRoots.push(tempRoot);
  execGit(tempRoot, ["init", "-q"]);
  execGit(tempRoot, ["config", "user.email", "test@example.com"]);
  execGit(tempRoot, ["config", "user.name", "Test User"]);

  await writeFile(join(tempRoot, "README.md"), "init\n", "utf8");
  execGit(tempRoot, ["add", "."]);
  execGit(tempRoot, ["commit", "-q", "-m", "init"]);

  return { tempRoot, baseSha: execGit(tempRoot, ["rev-parse", "HEAD"]) };
};

const commitAll = (cwd: string, message: string) => {
  execGit(cwd, ["add", "-A"]);
  execGit(cwd, ["commit", "-q", "-m", message]);
  return execGit(cwd, ["rev-parse", "HEAD"]);
};

const writeChangeset = async (root: string, body: string, name = "test.md") => {
  await mkdir(join(root, ".changeset"), { recursive: true });
  await writeFile(join(root, ".changeset", name), body, "utf8");
};

const writeSource = async (root: string, relativePath: string) => {
  await mkdir(join(root, dirname(relativePath)), { recursive: true });
  await writeFile(join(root, relativePath), "export const changed = true\n", "utf8");
};

const env = (baseSha: string, headSha: string, overrides: Record<string, string> = {}) => ({
  BASE_SHA: baseSha,
  HEAD_SHA: headSha,
  GITHUB_REPOSITORY: "rxova/journey",
  PR_NUMBER: "1",
  PR_TITLE: "",
  // Empty on purpose: with no token the script skips the label lookup, so these
  // cases exercise the gate itself rather than the GitHub API.
  GH_TOKEN: "",
  ...overrides
});

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("check-changeset", () => {
  it("passes when a single-package changeset is present", async () => {
    const { tempRoot, baseSha } = await initRepo();
    await writeChangeset(tempRoot, '---\n"@rxova/journey-core": patch\n---\n\nchange\n');
    const headSha = commitAll(tempRoot, "add changeset");

    expect(runScript(tempRoot, env(baseSha, headSha)).code).toBe(0);
  });

  // Prettier with singleQuote rewrites changeset frontmatter. A
  // double-quote-only pattern counts zero packages here and fails a valid
  // changeset — which is exactly what the pre-standardisation copy did.
  it("accepts single-quoted package names (Prettier style)", async () => {
    const { tempRoot, baseSha } = await initRepo();
    await writeChangeset(tempRoot, "---\n'@rxova/journey-core': minor\n---\n\nchange\n");
    const headSha = commitAll(tempRoot, "add single-quoted changeset");

    expect(runScript(tempRoot, env(baseSha, headSha)).code).toBe(0);
  });

  it("fails when a changeset file declares more than one package", async () => {
    const { tempRoot, baseSha } = await initRepo();
    await writeChangeset(
      tempRoot,
      '---\n"@rxova/journey-core": patch\n"@rxova/journey-react": patch\n---\n\nchange\n'
    );
    const headSha = commitAll(tempRoot, "add multi-package changeset");

    const result = runScript(tempRoot, env(baseSha, headSha));
    expect(result.code).toBe(1);
    expect(result.output).toContain("expected exactly 1 package, found 2");
  });

  it("fails when a published package changes with no changeset", async () => {
    const { tempRoot, baseSha } = await initRepo();
    await writeSource(tempRoot, "packages/core/src/index.ts");
    const headSha = commitAll(tempRoot, "change a published package");

    const result = runScript(tempRoot, env(baseSha, headSha));
    expect(result.code).toBe(1);
    expect(result.output).toContain("No changeset found");
  });

  it("skips when [skip-changeset] is in the PR title", async () => {
    const { tempRoot, baseSha } = await initRepo();
    await writeSource(tempRoot, "packages/core/src/index.ts");
    const headSha = commitAll(tempRoot, "change a published package");

    const result = runScript(
      tempRoot,
      env(baseSha, headSha, { PR_TITLE: "chore: tweak [skip-changeset]" })
    );
    expect(result.code).toBe(0);
    expect(result.output).toContain("[skip-changeset] found in PR title");
  });

  // The directory branches of allowedPattern have to match paths *beneath* the
  // directory. Anchored alternatives (`^\.github\/$`) match only the bare
  // string and silently never fire.
  it("auto-skips a diff that only touches workflow files", async () => {
    const { tempRoot, baseSha } = await initRepo();
    await mkdir(join(tempRoot, ".github", "workflows"), { recursive: true });
    await writeFile(join(tempRoot, ".github", "workflows", "ci.yml"), "name: CI\n", "utf8");
    const headSha = commitAll(tempRoot, "ci: tweak");

    const result = runScript(tempRoot, env(baseSha, headSha));
    expect(result.code).toBe(0);
    expect(result.output).toContain("Docs/CI/config-only");
  });

  it("does not count a deleted changeset as one being present", async () => {
    const { tempRoot, baseSha } = await initRepo();
    await writeChangeset(tempRoot, '---\n"@rxova/journey-core": patch\n---\n\nchange\n');
    commitAll(tempRoot, "add changeset");

    await rm(join(tempRoot, ".changeset", "test.md"));
    await writeSource(tempRoot, "packages/core/src/index.ts");
    const headSha = commitAll(tempRoot, "remove the changeset again");

    const result = runScript(tempRoot, env(baseSha, headSha));
    expect(result.code).toBe(1);
    expect(result.output).toContain("No changeset found");
  });

  it("fails loudly when required environment is missing", async () => {
    const { tempRoot, baseSha } = await initRepo();
    await writeFile(join(tempRoot, "NOTES.md"), "note\n", "utf8");
    const headSha = commitAll(tempRoot, "docs: note");

    const incomplete = env(baseSha, headSha);
    delete (incomplete as Partial<typeof incomplete>).BASE_SHA;

    expect(runScript(tempRoot, incomplete as Record<string, string>).code).not.toBe(0);
  });
});
