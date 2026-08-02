import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DOCS_ROOT,
  checkDocsBannedIdentifiers,
  collectDocsFiles,
  collectReadmeFiles,
  isAllowlistedFile,
  isExcludedPath,
  scanContent
} from "../check-docs-banned-identifiers";

let tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.map((root) => rm(root, { recursive: true, force: true })));
  tempRoots = [];
});

const createRepoRoot = async (files: Record<string, string>): Promise<string> => {
  const repoRoot = await mkdtemp(join(tmpdir(), "check-docs-banned-"));
  tempRoots.push(repoRoot);

  for (const [relativePath, content] of Object.entries(files)) {
    const absolutePath = join(repoRoot, DOCS_ROOT, relativePath);
    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, content, "utf8");
  }

  return repoRoot;
};

const runCheck = (repoRoot: string) => {
  const log = vi.fn();
  const error = vi.fn();
  const exit = vi.fn();
  const { matches } = checkDocsBannedIdentifiers({ repoRoot, log, error, exit });
  return { matches, log, error, exit };
};

describe("scanContent", () => {
  it("reports banned identifiers with 1-based line numbers", () => {
    const matches = scanContent("ok line\nuse `createJourneyMachine` here\n");
    expect(matches).toEqual([{ line: 2, identifier: "createJourneyMachine" }]);
  });

  it("does not flag the current createGraphJourneyBuilder name", () => {
    expect(scanContent("call createGraphJourneyBuilder<Bag>()")).toEqual([]);
  });

  it("flags machine.subscribeStart but not the plugin's subscribeStart", () => {
    expect(scanContent("machine.subscribeStart(listener)")).toEqual([
      { line: 1, identifier: "machine.subscribeStart" }
    ]);
    expect(scanContent("lifecycle.subscribeStart(listener)")).toEqual([]);
  });

  it("flags the standalone JourneyProvider identifier only", () => {
    expect(scanContent("<JourneyProvider journey={journey}>")).toEqual([
      { line: 1, identifier: "JourneyProvider" }
    ]);
    expect(scanContent("<checkout.Provider views={views}>")).toEqual([]);
  });
});

describe("allowlist and exclusions", () => {
  it("allowlists the migration guide and release-notes pages", () => {
    expect(isAllowlistedFile("core/pre-1-0-migration.md")).toBe(true);
    expect(isAllowlistedFile("core/releases.md")).toBe(true);
    expect(isAllowlistedFile("react/releases.md")).toBe(true);
    expect(isAllowlistedFile("core/stability.md")).toBe(false);
  });

  it("excludes generated reference trees and versioned docs", () => {
    expect(isExcludedPath("core/api/reference/functions/createGraphJourney.md")).toBe(true);
    expect(isExcludedPath("versioned_docs/version-1.0/core/about.md")).toBe(true);
    expect(isExcludedPath("core/api/machine-api.md")).toBe(false);
  });
});

describe("collectDocsFiles", () => {
  it("collects markdown files and skips excluded or allowlisted paths", async () => {
    const repoRoot = await createRepoRoot({
      "core/about.md": "clean",
      "core/faq.mdx": "clean",
      "core/releases.md": "old createJourneyMachine history",
      "core/pre-1-0-migration.md": "createJourneyMachine mapping",
      "core/api/reference/functions/createLinearJourney.md": "generated",
      "core/notes.txt": "not a doc"
    });

    expect(collectDocsFiles(join(repoRoot, DOCS_ROOT))).toEqual(["core/about.md", "core/faq.mdx"]);
  });
});

describe("checkDocsBannedIdentifiers", () => {
  it("passes on clean docs", async () => {
    const repoRoot = await createRepoRoot({
      "core/usage/headless.md": "Headless is a usage pattern over createLinearJourney."
    });

    const { matches, log, exit } = runCheck(repoRoot);

    expect(matches).toEqual([]);
    expect(exit).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(expect.stringContaining("1 files scanned"));
  });

  it("fails listing file:line matches for banned identifiers", async () => {
    const repoRoot = await createRepoRoot({
      "core/stale.md": "First line\nCall `useJourneyApi()` and commandsEnabled here.\n"
    });

    const { matches, error, exit } = runCheck(repoRoot);

    expect(matches).toEqual([
      { file: `${DOCS_ROOT}/core/stale.md`, line: 2, identifier: "useJourneyApi" },
      { file: `${DOCS_ROOT}/core/stale.md`, line: 2, identifier: "commandsEnabled" }
    ]);
    expect(exit).toHaveBeenCalledWith(1);
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining("apps/docs/src/content/docs/core/stale.md:2 (useJourneyApi)")
    );
  });

  it("ignores banned identifiers inside allowlisted and excluded files", async () => {
    const repoRoot = await createRepoRoot({
      "core/pre-1-0-migration.md": "createHeadlessJourney -> usage pattern",
      "bridge/releases.md": "commandsEnabled was replaced",
      "core/api/reference/type-aliases/Old.md": "createJourneyMachine leftover"
    });

    const { matches, exit } = runCheck(repoRoot);

    expect(matches).toEqual([]);
    expect(exit).not.toHaveBeenCalled();
  });
});

describe("README scanning", () => {
  it("collects the root README and every package README that exists", async () => {
    const repoRoot = await createRepoRoot({});
    await writeFile(join(repoRoot, "README.md"), "root", "utf8");
    await mkdir(join(repoRoot, "packages/core"), { recursive: true });
    await writeFile(join(repoRoot, "packages/core/README.md"), "core", "utf8");
    // A package without a README must not be collected.
    await mkdir(join(repoRoot, "packages/common"), { recursive: true });

    expect(collectReadmeFiles(repoRoot)).toEqual(["README.md", "packages/core/README.md"]);
  });

  it("returns nothing when neither the root README nor packages/ exists", async () => {
    const repoRoot = await createRepoRoot({});

    expect(collectReadmeFiles(repoRoot)).toEqual([]);
  });

  it("flags a banned identifier in the root README", async () => {
    const repoRoot = await createRepoRoot({ "core/ok.md": "current api" });
    await writeFile(
      join(repoRoot, "README.md"),
      "intro\nimport from `@rxova/journey-react/headless`\n",
      "utf8"
    );

    const { matches, exit } = runCheck(repoRoot);

    expect(matches).toEqual([{ file: "README.md", line: 2, identifier: "journey-react/headless" }]);
    expect(exit).toHaveBeenCalledWith(1);
  });

  it("flags a banned identifier in a published package README", async () => {
    const repoRoot = await createRepoRoot({ "core/ok.md": "current api" });
    await mkdir(join(repoRoot, "packages/react"), { recursive: true });
    await writeFile(join(repoRoot, "packages/react/README.md"), "use useApi() here\n", "utf8");

    const { matches, exit } = runCheck(repoRoot);

    expect(matches).toEqual([{ file: "packages/react/README.md", line: 1, identifier: "useApi" }]);
    expect(exit).toHaveBeenCalledWith(1);
  });

  it("does not flag useJourney, which is a current API", async () => {
    const repoRoot = await createRepoRoot({ "core/ok.md": "current api" });
    await writeFile(join(repoRoot, "README.md"), "const b = useJourney(() => create());\n", "utf8");

    const { matches, exit } = runCheck(repoRoot);

    expect(matches).toEqual([]);
    expect(exit).not.toHaveBeenCalled();
  });
});
