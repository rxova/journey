import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

import {
  checkMatches,
  checkReleaseNotes,
  expectedContent,
  isEntrypoint,
  main,
  normalizeChangelog,
  readUtf8,
  renderReleaseDoc,
  syncReleaseNotes,
  toRepoPath,
  writeIfChanged
} from "../../../scripts/sync-doc-release-notes.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const scriptPath = resolve(__dirname, "../../../scripts/sync-doc-release-notes.mjs");

const oneSource = [
  {
    source: "changelogs/core.md",
    target: "docs/core/releases.md",
    title: "Core Releases",
    description: "Generated from changelog."
  }
];

async function makeWorkspace(changelogBody = "# Core\n\n## 1.0.0\n\n- Added thing\n") {
  const root = await mkdtemp(join(tmpdir(), "sync-doc-release-notes-"));
  await mkdir(join(root, "changelogs"), { recursive: true });
  await writeFile(join(root, "changelogs/core.md"), changelogBody, "utf8");
  return root;
}

describe("sync-doc-release-notes script", () => {
  it("normalizes changelog with heading and leading blank lines", () => {
    const normalized = normalizeChangelog("# Title\n\n## 1.0.0\n\n- x\n");
    expect(normalized).toBe("## 1.0.0\n\n- x\n");
  });

  it("normalizes changelog without top heading", () => {
    const normalized = normalizeChangelog("## 1.0.0\n\n- x\n");
    expect(normalized).toBe("## 1.0.0\n\n- x\n");
  });

  it("normalizes changelog and escapes inline generics for MDX", () => {
    const normalized = normalizeChangelog(
      "# Title\n\n## 1.0.0\n\n- Uses Record<string, unknown>\n- Keeps `Map<string, number>` untouched\n"
    );

    expect(normalized).toContain("- Uses `Record<string, unknown>`");
    expect(normalized).toContain("- Keeps `Map<string, number>` untouched");
  });

  it("reads utf8 and normalizes CRLF", async () => {
    const root = await makeWorkspace();
    const filePath = join(root, "crlf.md");
    await writeFile(filePath, "a\r\nb\r\n", "utf8");

    expect(readUtf8(filePath)).toBe("a\nb\n");
    await rm(root, { recursive: true, force: true });
  });

  it("renders release markdown with frontmatter and source", () => {
    const rendered = renderReleaseDoc(oneSource[0], "## 1.0.0\n\n- Added\n");
    expect(rendered).toContain("title: Core Releases");
    expect(rendered).toContain(
      "Source: [`changelogs/core.md`](https://github.com/rxova/journey/blob/main/changelogs/core.md)"
    );
    expect(rendered).toContain("## 1.0.0");
  });

  it("builds repo paths", () => {
    expect(toRepoPath("/repo", "a", "b")).toBe("/repo/a/b");
  });

  it("writes when file does not exist and skips when unchanged", async () => {
    const root = await makeWorkspace();
    const filePath = join(root, "out.md");

    expect(writeIfChanged(filePath, "hello\n")).toBe(true);
    expect(writeIfChanged(filePath, "hello\n")).toBe(false);
    expect(await readFile(filePath, "utf8")).toBe("hello\n");

    await rm(root, { recursive: true, force: true });
  });

  it("checkMatches handles present and missing files", async () => {
    const root = await makeWorkspace();
    const filePath = join(root, "out.md");
    await writeFile(filePath, "hello\n", "utf8");

    expect(checkMatches(filePath, "hello\n")).toBe(true);
    expect(checkMatches(filePath, "different\n")).toBe(false);
    expect(checkMatches(join(root, "missing.md"), "anything\n")).toBe(false);

    await rm(root, { recursive: true, force: true });
  });

  it("computes expected content from source changelog", async () => {
    const root = await makeWorkspace("# Core\n\n## 2.0.0\n\n- Big with Record<string, unknown>\n");
    const content = expectedContent(oneSource[0], root);

    expect(content).toContain("title: Core Releases");
    expect(content).toContain("## 2.0.0");
    expect(content).toContain("`Record<string, unknown>`");
    expect(content).not.toContain("# Core");

    await rm(root, { recursive: true, force: true });
  });

  it("syncReleaseNotes updates files and reports updated list", async () => {
    const root = await makeWorkspace();
    const logs: string[] = [];

    const result = syncReleaseNotes({
      repoRoot: root,
      sources: oneSource,
      log: (message) => logs.push(message)
    });

    expect(result.updated).toEqual(["docs/core/releases.md"]);
    expect(logs).toEqual(["Updated docs/core/releases.md"]);
    expect(await readFile(join(root, "docs/core/releases.md"), "utf8")).toContain("## 1.0.0");

    await rm(root, { recursive: true, force: true });
  });

  it("syncReleaseNotes no-ops when docs are already current", async () => {
    const root = await makeWorkspace();
    syncReleaseNotes({ repoRoot: root, sources: oneSource });

    const logs: string[] = [];
    const result = syncReleaseNotes({
      repoRoot: root,
      sources: oneSource,
      log: (message) => logs.push(message)
    });

    expect(result.updated).toEqual([]);
    expect(logs).toEqual(["Release note docs are already up to date."]);

    await rm(root, { recursive: true, force: true });
  });

  it("checkReleaseNotes passes for up-to-date files", async () => {
    const root = await makeWorkspace();
    syncReleaseNotes({ repoRoot: root, sources: oneSource });

    const logs: string[] = [];
    const result = checkReleaseNotes({
      repoRoot: root,
      sources: oneSource,
      log: (message) => logs.push(message)
    });

    expect(result.stale).toEqual([]);
    expect(logs).toEqual(["Release note docs are up to date."]);

    await rm(root, { recursive: true, force: true });
  });

  it("checkReleaseNotes fails with stale files and reports each file", async () => {
    const root = await makeWorkspace();
    const errors: string[] = [];
    const exit = vi.fn();

    const result = checkReleaseNotes({
      repoRoot: root,
      sources: oneSource,
      error: (message) => errors.push(message),
      exit
    });

    expect(result.stale).toEqual(["docs/core/releases.md"]);
    expect(exit).toHaveBeenCalledWith(1);
    expect(errors).toEqual([
      "Release note docs are out of date. Run: pnpm run docs:release-notes:sync",
      "- docs/core/releases.md"
    ]);

    await rm(root, { recursive: true, force: true });
  });

  it("checkReleaseNotes uses default exit handler when stale", async () => {
    const root = await makeWorkspace();
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
      code?: string | number | null | undefined
    ) => {
      throw new Error(`exit:${code}`);
    }) as never);

    expect(() =>
      checkReleaseNotes({
        repoRoot: root,
        sources: oneSource,
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
      argv: ["node", "script.mjs"],
      repoRoot: root,
      sources: oneSource,
      log: (message) => syncLogs.push(message)
    });

    expect(syncResult.updated).toEqual(["docs/core/releases.md"]);
    expect(syncLogs).toEqual(["Updated docs/core/releases.md"]);

    const checkLogs: string[] = [];
    const checkResult = main({
      argv: ["node", "script.mjs", "--check"],
      repoRoot: root,
      sources: oneSource,
      log: (message) => checkLogs.push(message)
    });

    expect(checkResult.stale).toEqual([]);
    expect(checkLogs).toEqual(["Release note docs are up to date."]);

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
        argv: ["node", "script.mjs", "--check"],
        repoRoot: root,
        sources: oneSource,
        error: () => {}
      })
    ).toThrow("exit:1");

    exitSpy.mockRestore();
    await rm(root, { recursive: true, force: true });
  });

  it("entrypoint detection handles all branches", () => {
    expect(isEntrypoint("", "file:///a/script.mjs")).toBe(false);
    expect(isEntrypoint("/a/script.mjs", "file:///a/script.mjs")).toBe(true);
    expect(isEntrypoint("/a/other.mjs", "file:///a/script.mjs")).toBe(false);
  });

  it("script can run as a cli entrypoint in check mode", () => {
    execFileSync(process.execPath, [scriptPath, "--check"], {
      cwd: resolve(__dirname, "../../.."),
      stdio: "pipe",
      encoding: "utf8"
    });
  });
});
