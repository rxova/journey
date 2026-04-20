import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const scriptPath = resolve(__dirname, "../tooling/check-changeset.ts");
const tsxLoaderPath = resolve(__dirname, "../../../node_modules/tsx/dist/loader.mjs");
const sanitizedEnv = Object.fromEntries(
  Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_"))
);

const execGit = (cwd: string, args: string[]) =>
  execFileSync("git", args, {
    cwd,
    env: sanitizedEnv,
    stdio: "pipe",
    encoding: "utf8"
  }).trim();

const runScript = (cwd: string, env: Record<string, string>) => {
  try {
    execFileSync(process.execPath, ["--import", tsxLoaderPath, scriptPath], {
      cwd,
      env: { ...sanitizedEnv, ...env },
      stdio: "pipe",
      encoding: "utf8"
    });
    return { code: 0 };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    const stderr = [error?.stderr?.toString(), error?.stdout?.toString()]
      .filter((value): value is string => Boolean(value))
      .join("\n");

    return { code: error?.status ?? 1, stderr };
  }
};

const initRepo = async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "check-changeset-"));
  execGit(tempRoot, ["init", "-q"]);
  execGit(tempRoot, ["config", "user.email", "test@example.com"]);
  execGit(tempRoot, ["config", "user.name", "Test User"]);

  await writeFile(join(tempRoot, "README.md"), "init\n", "utf8");
  execGit(tempRoot, ["add", "."]);
  execGit(tempRoot, ["commit", "-m", "init"]);

  const baseSha = execGit(tempRoot, ["rev-parse", "HEAD"]);
  return { tempRoot, baseSha };
};

const commitAll = (cwd: string, message: string) => {
  execGit(cwd, ["add", "."]);
  execGit(cwd, ["commit", "-m", message]);
  return execGit(cwd, ["rev-parse", "HEAD"]);
};

const baseEnv = (baseSha: string, headSha: string) => ({
  BASE_SHA: baseSha,
  HEAD_SHA: headSha,
  GITHUB_REPOSITORY: "rxova/journey",
  PR_NUMBER: "1",
  PR_TITLE: ""
});

describe("check-changeset script", () => {
  it("passes when a single-package changeset is present", async () => {
    const { tempRoot, baseSha } = await initRepo();
    await mkdir(join(tempRoot, ".changeset"), { recursive: true });
    await writeFile(
      join(tempRoot, ".changeset", "test.md"),
      '---\n"@rxova/journey-core": patch\n---\nchange\n',
      "utf8"
    );

    const headSha = commitAll(tempRoot, "add changeset");
    const result = runScript(tempRoot, baseEnv(baseSha, headSha));

    expect(result.code).toBe(0);
    await rm(tempRoot, { recursive: true, force: true });
  });

  it("fails when a changeset file contains multiple packages", async () => {
    const { tempRoot, baseSha } = await initRepo();
    await mkdir(join(tempRoot, ".changeset"), { recursive: true });
    await writeFile(
      join(tempRoot, ".changeset", "test.md"),
      '---\n"@rxova/journey-core": patch\n"@rxova/journey-react": patch\n---\nchange\n',
      "utf8"
    );

    const headSha = commitAll(tempRoot, "add multi-package changeset");
    const result = runScript(tempRoot, baseEnv(baseSha, headSha));

    expect(result.code).toBe(1);
    expect(result.stderr ?? "").toContain("Invalid changeset format");
    expect(result.stderr ?? "").toContain("expected exactly 1 package, found 2");
    await rm(tempRoot, { recursive: true, force: true });
  });

  it("passes for docs/ci/config-only changes", async () => {
    const { tempRoot, baseSha } = await initRepo();
    await mkdir(join(tempRoot, "docs"), { recursive: true });
    await writeFile(join(tempRoot, "docs", "guide.md"), "docs\n", "utf8");

    const headSha = commitAll(tempRoot, "docs only");
    const result = runScript(tempRoot, baseEnv(baseSha, headSha));

    expect(result.code).toBe(0);
    await rm(tempRoot, { recursive: true, force: true });
  });

  it("passes when deleted changesets are replaced by current single-package files", async () => {
    const { tempRoot } = await initRepo();
    await mkdir(join(tempRoot, ".changeset"), { recursive: true });
    await writeFile(
      join(tempRoot, ".changeset", "old-core.md"),
      '---\n"@rxova/journey-core": patch\n---\nold change\n',
      "utf8"
    );

    const baseSha = commitAll(tempRoot, "seed old changeset");

    await rm(join(tempRoot, ".changeset", "old-core.md"));
    await writeFile(
      join(tempRoot, ".changeset", "new-core.md"),
      '---\n"@rxova/journey-core": patch\n---\nnew change\n',
      "utf8"
    );

    const headSha = commitAll(tempRoot, "replace changeset");
    const result = runScript(tempRoot, baseEnv(baseSha, headSha));

    expect(result.code).toBe(0);
    await rm(tempRoot, { recursive: true, force: true });
  });

  it("fails when package code changes without a changeset", async () => {
    const { tempRoot, baseSha } = await initRepo();
    const srcDir = join(tempRoot, "packages", "core", "src");
    await mkdir(srcDir, { recursive: true });
    await writeFile(join(srcDir, "index.ts"), "export const x = 1;\n", "utf8");

    const headSha = commitAll(tempRoot, "core change");
    const result = runScript(tempRoot, baseEnv(baseSha, headSha));

    expect(result.code).toBe(1);
    expect(result.stderr ?? "").toContain("No changeset found");
    await rm(tempRoot, { recursive: true, force: true });
  });

  it("fails when only deleted changesets remain for package code changes", async () => {
    const { tempRoot } = await initRepo();
    await mkdir(join(tempRoot, ".changeset"), { recursive: true });
    await writeFile(
      join(tempRoot, ".changeset", "old-core.md"),
      '---\n"@rxova/journey-core": patch\n---\nold change\n',
      "utf8"
    );

    const baseSha = commitAll(tempRoot, "seed old changeset");

    await rm(join(tempRoot, ".changeset", "old-core.md"));
    const srcDir = join(tempRoot, "packages", "core", "src");
    await mkdir(srcDir, { recursive: true });
    await writeFile(join(srcDir, "index.ts"), "export const x = 1;\n", "utf8");

    const headSha = commitAll(tempRoot, "delete changeset and change core");
    const result = runScript(tempRoot, baseEnv(baseSha, headSha));

    expect(result.code).toBe(1);
    expect(result.stderr ?? "").toContain("No changeset found");
    await rm(tempRoot, { recursive: true, force: true });
  });
});
