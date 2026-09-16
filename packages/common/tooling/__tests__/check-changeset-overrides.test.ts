import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CHANGESET_ROOT,
  checkChangesetOverrides,
  collectChangesetFiles,
  isChangesetFile,
  isEntrypoint,
  main,
  scanContent,
  splitFrontmatter
} from "../check-changeset-overrides";

let tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.map((root) => rm(root, { recursive: true, force: true })));
  tempRoots = [];
});

const createRepoRoot = async (files: Record<string, string>): Promise<string> => {
  const repoRoot = await mkdtemp(join(tmpdir(), "check-changeset-overrides-"));
  tempRoots.push(repoRoot);
  await mkdir(join(repoRoot, CHANGESET_ROOT), { recursive: true });

  for (const [fileName, content] of Object.entries(files)) {
    await writeFile(join(repoRoot, CHANGESET_ROOT, fileName), content, "utf8");
  }

  return repoRoot;
};

const runCheck = (repoRoot: string) => {
  const log = vi.fn();
  const error = vi.fn();
  const exit = vi.fn();
  const { matches } = checkChangesetOverrides({ repoRoot, log, error, exit });
  return { matches, log, error, exit };
};

const withFrontmatter = (summary: string): string =>
  `---\n"@rxova/journey-core": minor\n---\n\n${summary}`;

describe("splitFrontmatter", () => {
  it("drops the frontmatter and reports the summary's first line", () => {
    expect(splitFrontmatter(withFrontmatter("prose"))).toEqual({
      summary: "\nprose",
      firstLine: 4
    });
  });

  it("treats a file with no frontmatter as all summary", () => {
    expect(splitFrontmatter("just prose\n")).toEqual({ summary: "just prose\n", firstLine: 1 });
  });

  it("treats unterminated frontmatter as all summary rather than swallowing the file", () => {
    const content = '---\n"@rxova/journey-core": minor\nprose';
    expect(splitFrontmatter(content)).toEqual({ summary: content, firstLine: 1 });
  });
});

describe("scanContent", () => {
  it("flags a commit: line and reports its line number in the whole file", () => {
    const matches = scanContent(withFrontmatter("intro\n  commit: ({ result }) => stage(result)"));
    expect(matches).toEqual([
      { line: 6, override: "commit:", text: "commit: ({ result }) => stage(result)" }
    ]);
  });

  it("ignores the release bump in the frontmatter", () => {
    expect(scanContent('---\n"@rxova/journey-core": minor\n---\n\nprose\n')).toEqual([]);
  });

  it("flags the pr, pull request and author overrides", () => {
    expect(scanContent(withFrontmatter("pr: #123"))[0]?.override).toBe(
      "pr: / pull: / pull request:"
    );
    expect(scanContent(withFrontmatter("pull request: 123"))[0]?.override).toBe(
      "pr: / pull: / pull request:"
    );
    expect(scanContent(withFrontmatter("author: @someone"))[0]?.override).toBe("author: / user:");
    expect(scanContent(withFrontmatter("user: someone"))[0]?.override).toBe("author: / user:");
  });

  it("matches case-insensitively, the way changelog-github does", () => {
    expect(scanContent(withFrontmatter("Commit: abc123"))).toHaveLength(1);
  });

  it("leaves the keyword alone when it does not start a line", () => {
    expect(scanContent(withFrontmatter("run: work(), commit: stage()"))).toEqual([]);
    expect(scanContent(withFrontmatter("/* typed above */ commit: stage()"))).toEqual([]);
    expect(scanContent(withFrontmatter("the commit: phase stages the result"))).toEqual([]);
  });

  it("requires a value after the keyword", () => {
    expect(scanContent(withFrontmatter("commit:"))).toEqual([]);
  });

  it("flags a match inside a fenced code block, because upstream does not parse fences", () => {
    expect(scanContent(withFrontmatter("```ts\ncommit: stage()\n```"))).toHaveLength(1);
  });
});

describe("isChangesetFile", () => {
  it("accepts changeset markdown and skips the directory's own README", () => {
    expect(isChangesetFile("brave-pandas-smile.md")).toBe(true);
    expect(isChangesetFile("README.md")).toBe(false);
    expect(isChangesetFile("config.json")).toBe(false);
  });
});

describe("collectChangesetFiles", () => {
  it("returns sorted changeset files and skips the README", async () => {
    const repoRoot = await createRepoRoot({
      "b.md": withFrontmatter("b"),
      "a.md": withFrontmatter("a"),
      "README.md": "# Changesets"
    });
    expect(collectChangesetFiles(join(repoRoot, CHANGESET_ROOT))).toEqual(["a.md", "b.md"]);
  });

  it("returns nothing when the directory is absent", async () => {
    const repoRoot = await createRepoRoot({});
    expect(collectChangesetFiles(join(repoRoot, "does-not-exist"))).toEqual([]);
  });
});

describe("checkChangesetOverrides", () => {
  it("passes and logs a count when every summary is prose", async () => {
    const repoRoot = await createRepoRoot({ "ok.md": withFrontmatter("plain prose\n") });
    const { matches, log, error, exit } = runCheck(repoRoot);

    expect(matches).toEqual([]);
    expect(exit).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(expect.stringContaining("(1 scanned)"));
  });

  it("fails with a repo-relative location when a summary carries an override", async () => {
    const repoRoot = await createRepoRoot({
      "bad.md": withFrontmatter("commit: ({ result }) => x")
    });
    const { matches, error, exit } = runCheck(repoRoot);

    expect(matches).toEqual([
      {
        file: `${CHANGESET_ROOT}/bad.md`,
        line: 5,
        override: "commit:",
        text: "commit: ({ result }) => x"
      }
    ]);
    expect(exit).toHaveBeenCalledWith(1);
    expect(error).toHaveBeenCalledWith(expect.stringContaining(`${CHANGESET_ROOT}/bad.md:5`));
  });

  it("reports every offending file", async () => {
    const repoRoot = await createRepoRoot({
      "one.md": withFrontmatter("commit: a"),
      "two.md": withFrontmatter("author: @b"),
      "fine.md": withFrontmatter("prose")
    });
    expect(runCheck(repoRoot).matches).toHaveLength(2);
  });

  it("main delegates to the check", async () => {
    const repoRoot = await createRepoRoot({ "ok.md": withFrontmatter("prose") });
    const log = vi.fn();
    expect(main({ repoRoot, log, error: vi.fn(), exit: vi.fn() }).matches).toEqual([]);
    expect(log).toHaveBeenCalled();
  });
});

describe("isEntrypoint", () => {
  it("is false when the process was started with no script argument", () => {
    expect(isEntrypoint(undefined, "file:///tooling/check-changeset-overrides.ts")).toBe(false);
  });

  it("is true only when the started script is this module", () => {
    expect(isEntrypoint("/tooling/check.ts", "file:///tooling/check.ts")).toBe(true);
    expect(isEntrypoint("/tooling/other.ts", "file:///tooling/check.ts")).toBe(false);
  });
});
