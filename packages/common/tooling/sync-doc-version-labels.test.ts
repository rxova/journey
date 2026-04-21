import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

import {
  assertSemver,
  buildVersionLabels,
  checkDocVersionLabels,
  checkMatches,
  expectedContent,
  isEntrypoint,
  main,
  readJson,
  readUtf8,
  syncDocVersionLabels,
  toRepoPath,
  writeIfChanged
} from "./sync-doc-version-labels";

const __dirname = dirname(fileURLToPath(import.meta.url));
const scriptPath = resolve(__dirname, "./sync-doc-version-labels.ts");

const testSources = [
  { pluginId: "core", source: "packages/core/package.json" },
  { pluginId: "react", source: "packages/react/package.json" },
  { pluginId: "bridge", source: "packages/devtools-bridge/package.json" },
  { pluginId: "chrome-devtools", source: "apps/devtools/package.json" }
] as const;

const writeJson = async (filePath: string, data: unknown) => {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
};

async function makeWorkspace() {
  const root = await mkdtemp(join(tmpdir(), "sync-doc-version-labels-"));
  await writeJson(join(root, "packages/core/package.json"), { name: "core", version: "0.6.2" });
  await writeJson(join(root, "packages/react/package.json"), { name: "react", version: "0.7.1" });
  await writeJson(join(root, "packages/devtools-bridge/package.json"), {
    name: "bridge",
    version: "0.6.5"
  });
  await writeJson(join(root, "apps/devtools/package.json"), {
    name: "apps-devtools",
    version: "0.6.0"
  });
  return root;
}

describe("sync-doc-version-labels script", () => {
  it("reads utf8 and json helpers", async () => {
    const root = await makeWorkspace();
    const filePath = join(root, "tmp.json");
    await writeFile(filePath, '{\r\n  "a": 1\r\n}\r\n', "utf8");

    expect(readUtf8(filePath)).toBe('{\n  "a": 1\n}\n');
    expect(readJson(filePath)).toEqual({ a: 1 });
    await rm(root, { recursive: true, force: true });
  });

  it("builds repo paths", () => {
    expect(toRepoPath("/repo", "apps", "docs")).toBe("/repo/apps/docs");
  });

  it("accepts valid semver and rejects invalid semver", () => {
    expect(() => assertSemver("1.2.3", "pkg")).not.toThrow();
    expect(() => assertSemver("1.2.3-beta.1", "pkg")).not.toThrow();
    expect(() => assertSemver("bad", "pkg")).toThrow('Invalid semver version "bad" for pkg');
  });

  it("builds labels from configured package sources", async () => {
    const root = await makeWorkspace();
    const labels = buildVersionLabels(root, testSources);

    expect(labels).toEqual({
      core: "0.6.2",
      react: "0.7.1",
      bridge: "0.6.5",
      "chrome-devtools": "0.6.0"
    });

    await rm(root, { recursive: true, force: true });
  });

  it("throws when package version field is missing", async () => {
    const root = await makeWorkspace();
    await writeJson(join(root, "packages/react/package.json"), { name: "react" });

    expect(() => buildVersionLabels(root, testSources)).toThrow(
      'Missing "version" in packages/react/package.json'
    );

    await rm(root, { recursive: true, force: true });
  });

  it("renders expected JSON content with newline", async () => {
    const root = await makeWorkspace();
    const content = expectedContent(root, testSources);

    expect(content).toContain('"core": "0.6.2"');
    expect(content.endsWith("\n")).toBe(true);

    await rm(root, { recursive: true, force: true });
  });

  it("writeIfChanged handles missing and unchanged files", async () => {
    const root = await makeWorkspace();
    const target = join(root, "apps/docs/version-labels.json");

    expect(writeIfChanged(target, "{\n}\n")).toBe(true);
    expect(writeIfChanged(target, "{\n}\n")).toBe(false);
    expect(await readFile(target, "utf8")).toBe("{\n}\n");

    await rm(root, { recursive: true, force: true });
  });

  it("checkMatches handles existing, mismatch and missing files", async () => {
    const root = await makeWorkspace();
    const target = join(root, "apps/docs/version-labels.json");
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, "{\n}\n", "utf8");

    expect(checkMatches(target, "{\n}\n")).toBe(true);
    expect(checkMatches(target, '{"a":1}\n')).toBe(false);
    expect(checkMatches(join(root, "missing.json"), "{}\n")).toBe(false);

    await rm(root, { recursive: true, force: true });
  });

  it("sync updates target file and reports updated", async () => {
    const root = await makeWorkspace();
    const logs: string[] = [];
    const result = syncDocVersionLabels({
      repoRoot: root,
      sources: testSources,
      target: "apps/docs/version-labels.json",
      log: (message: string) => logs.push(message)
    });

    expect(result).toEqual({ updated: true, target: "apps/docs/version-labels.json" });
    expect(logs).toEqual(["Updated apps/docs/version-labels.json"]);
    expect(await readFile(join(root, "apps/docs/version-labels.json"), "utf8")).toContain(
      '"react": "0.7.1"'
    );

    await rm(root, { recursive: true, force: true });
  });

  it("sync no-ops when file is up to date", async () => {
    const root = await makeWorkspace();
    syncDocVersionLabels({
      repoRoot: root,
      sources: testSources,
      target: "apps/docs/version-labels.json"
    });

    const logs: string[] = [];
    const result = syncDocVersionLabels({
      repoRoot: root,
      sources: testSources,
      target: "apps/docs/version-labels.json",
      log: (message: string) => logs.push(message)
    });

    expect(result).toEqual({ updated: false, target: "apps/docs/version-labels.json" });
    expect(logs).toEqual(["Doc version labels are already up to date."]);

    await rm(root, { recursive: true, force: true });
  });

  it("check passes when labels file matches expected", async () => {
    const root = await makeWorkspace();
    syncDocVersionLabels({
      repoRoot: root,
      sources: testSources,
      target: "apps/docs/version-labels.json"
    });

    const logs: string[] = [];
    const result = checkDocVersionLabels({
      repoRoot: root,
      sources: testSources,
      target: "apps/docs/version-labels.json",
      log: (message: string) => logs.push(message)
    });

    expect(result).toEqual({ stale: false, target: "apps/docs/version-labels.json" });
    expect(logs).toEqual(["Doc version labels are up to date."]);

    await rm(root, { recursive: true, force: true });
  });

  it("check fails when labels file is stale", async () => {
    const root = await makeWorkspace();
    const errors: string[] = [];
    const exit = vi.fn();

    const result = checkDocVersionLabels({
      repoRoot: root,
      sources: testSources,
      target: "apps/docs/version-labels.json",
      error: (message: string) => errors.push(message),
      exit
    });

    expect(result).toEqual({ stale: true, target: "apps/docs/version-labels.json" });
    expect(exit).toHaveBeenCalledWith(1);
    expect(errors).toEqual([
      "Doc version labels are out of date. Run: pnpm run docs:version-labels:sync",
      "- apps/docs/version-labels.json"
    ]);

    await rm(root, { recursive: true, force: true });
  });

  it("check uses default exit handler when stale", async () => {
    const root = await makeWorkspace();
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
      code?: string | number | null | undefined
    ) => {
      throw new Error(`exit:${code}`);
    }) as never);

    expect(() =>
      checkDocVersionLabels({
        repoRoot: root,
        sources: testSources,
        target: "apps/docs/version-labels.json",
        error: () => {}
      })
    ).toThrow("exit:1");

    exitSpy.mockRestore();
    await rm(root, { recursive: true, force: true });
  });

  it("main dispatches sync and check modes", async () => {
    const root = await makeWorkspace();
    const syncLogs: string[] = [];

    const syncResult = main({
      argv: ["node", "script.ts"],
      repoRoot: root,
      sources: testSources,
      target: "apps/docs/version-labels.json",
      log: (message: string) => syncLogs.push(message)
    });

    expect(syncResult).toEqual({ updated: true, target: "apps/docs/version-labels.json" });
    expect(syncLogs).toEqual(["Updated apps/docs/version-labels.json"]);

    const checkLogs: string[] = [];
    const checkResult = main({
      argv: ["node", "script.ts", "--check"],
      repoRoot: root,
      sources: testSources,
      target: "apps/docs/version-labels.json",
      log: (message: string) => checkLogs.push(message)
    });

    expect(checkResult).toEqual({ stale: false, target: "apps/docs/version-labels.json" });
    expect(checkLogs).toEqual(["Doc version labels are up to date."]);

    await rm(root, { recursive: true, force: true });
  });

  it("main uses default exit handler in stale check mode", async () => {
    const root = await makeWorkspace();
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
      code?: string | number | null | undefined
    ) => {
      throw new Error(`exit:${code}`);
    }) as never);

    expect(() =>
      main({
        argv: ["node", "script.ts", "--check"],
        repoRoot: root,
        sources: testSources,
        target: "apps/docs/version-labels.json",
        error: () => {}
      })
    ).toThrow("exit:1");

    exitSpy.mockRestore();
    await rm(root, { recursive: true, force: true });
  });

  it("entrypoint detection handles all branches", () => {
    expect(isEntrypoint("", "file:///a/script.ts")).toBe(false);
    expect(isEntrypoint("/a/script.ts", "file:///a/script.ts")).toBe(true);
    expect(isEntrypoint("/a/other.ts", "file:///a/script.ts")).toBe(false);
  });

  it("script can run as a cli entrypoint in check mode", () => {
    execFileSync(process.execPath, ["--import", "tsx", scriptPath, "--check"], {
      cwd: resolve(__dirname, "../../.."),
      stdio: "pipe",
      encoding: "utf8"
    });
  });
});
