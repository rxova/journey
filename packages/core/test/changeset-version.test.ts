import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

import {
  isEntrypoint,
  main,
  parseVersion,
  runChangesetVersion,
  syncRootVersion
} from "../../../scripts/changeset-version.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const scriptPath = resolve(__dirname, "../../../scripts/changeset-version.mjs");

async function writePackageJson(root: string, relativeDir: string, name: string, version: string) {
  const packageDir = join(root, relativeDir);
  await mkdir(packageDir, { recursive: true });
  await writeFile(
    join(packageDir, "package.json"),
    `${JSON.stringify({ name, version }, null, 2)}\n`,
    "utf8"
  );
}

async function makeRepo(
  rootVersion: string,
  versions: { core: string; react: string; bridge: string }
) {
  const tempRoot = await mkdtemp(join(tmpdir(), "changeset-version-"));
  await writeFile(
    join(tempRoot, "package.json"),
    `${JSON.stringify({ name: "repo", version: rootVersion }, null, 2)}\n`,
    "utf8"
  );
  await writePackageJson(tempRoot, "packages/core", "@rxova/journey-core", versions.core);
  await writePackageJson(tempRoot, "packages/react", "@rxova/journey-react", versions.react);
  await writePackageJson(
    tempRoot,
    "packages/devtools-bridge",
    "@rxova/journey-devtools-bridge",
    versions.bridge
  );
  return tempRoot;
}

describe("changeset-version script", () => {
  it("parses semver with and without prerelease", () => {
    expect(parseVersion("1.2.3")).toEqual({
      major: 1,
      minor: 2,
      patch: 3,
      prerelease: []
    });
    expect(parseVersion("1.2.3-beta.7")).toEqual({
      major: 1,
      minor: 2,
      patch: 3,
      prerelease: ["beta", 7]
    });
  });

  it("throws for invalid semver", () => {
    expect(() => parseVersion("invalid")).toThrow("Invalid semver version");
  });

  it("updates root version to match core", async () => {
    const tempRoot = await makeRepo("0.0.1", { core: "0.6.1", react: "0.7.0", bridge: "0.6.4" });
    const logs: string[] = [];
    const result = syncRootVersion(tempRoot, { log: (message) => logs.push(message) });
    const rootPackage = JSON.parse(await readFile(join(tempRoot, "package.json"), "utf8"));

    expect(result).toEqual({ updated: true, targetVersion: "0.6.1" });
    expect(rootPackage.version).toBe("0.6.1");
    expect(logs).toEqual(["Updated root package version to match core: 0.6.1"]);

    await rm(tempRoot, { recursive: true, force: true });
  });

  it("does not write when root already matches core", async () => {
    const tempRoot = await makeRepo("0.6.1", { core: "0.6.1", react: "0.6.5", bridge: "0.6.4" });
    const logs: string[] = [];
    const result = syncRootVersion(tempRoot, { log: (message) => logs.push(message) });

    expect(result).toEqual({ updated: false, targetVersion: "0.6.1" });
    expect(logs).toEqual(["Root package version already matches core: 0.6.1"]);

    await rm(tempRoot, { recursive: true, force: true });
  });

  it("fails when any release package has invalid semver", async () => {
    const tempRoot = await makeRepo("0.6.1", { core: "0.6.1", react: "oops", bridge: "0.6.4" });

    expect(() => syncRootVersion(tempRoot)).toThrow("Invalid semver version: oops");
    await rm(tempRoot, { recursive: true, force: true });
  });

  it("runs changeset version command with expected args", () => {
    const runner = vi.fn();
    runChangesetVersion({ runner, cwd: "/tmp/repo", stdio: "pipe" });
    expect(runner).toHaveBeenCalledWith("pnpm", ["exec", "changeset", "version"], {
      cwd: "/tmp/repo",
      stdio: "pipe"
    });
  });

  it("main orchestrates changeset + root sync", () => {
    const runChangesetVersionFn = vi.fn();
    const syncRootVersionFn = vi.fn(() => ({ updated: true, targetVersion: "0.6.1" }));

    const result = main({
      repoRoot: "/tmp/repo",
      runChangesetVersionFn,
      syncRootVersionFn
    });

    expect(runChangesetVersionFn).toHaveBeenCalledWith({ cwd: "/tmp/repo", stdio: "inherit" });
    expect(syncRootVersionFn).toHaveBeenCalledWith("/tmp/repo");
    expect(result).toEqual({ updated: true, targetVersion: "0.6.1" });
  });

  it("entrypoint detection handles all branches", () => {
    expect(isEntrypoint("", "file:///a/script.mjs")).toBe(false);
    expect(isEntrypoint("/a/script.mjs", "file:///a/script.mjs")).toBe(true);
    expect(isEntrypoint("/a/other.mjs", "file:///a/script.mjs")).toBe(false);
  });

  it("script can execute as cli entrypoint with fake pnpm", async () => {
    const tempRoot = await makeRepo("0.0.1", { core: "0.6.1", react: "0.6.3", bridge: "0.6.2" });
    const binDir = join(tempRoot, "bin");
    const fakePnpm = join(binDir, "pnpm");
    await mkdir(binDir, { recursive: true });
    await writeFile(fakePnpm, "#!/usr/bin/env sh\nexit 0\n", { mode: 0o755 });

    const { execFileSync } = await import("node:child_process");
    execFileSync(process.execPath, [scriptPath], {
      cwd: tempRoot,
      env: { ...process.env, PATH: `${binDir}:${process.env.PATH ?? ""}` },
      stdio: "pipe"
    });

    const rootPackage = JSON.parse(await readFile(join(tempRoot, "package.json"), "utf8"));
    expect(rootPackage.version).toBe("0.6.1");

    await rm(tempRoot, { recursive: true, force: true });
  });
});
