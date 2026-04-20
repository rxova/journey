import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { describe, expect, it, vi } from "vitest";

import {
  checkPublicApiTSDoc,
  collectMissingTSDocForSource,
  isEntrypoint,
  main,
  parseTsConfig,
  resolveApiTSDocSources,
  toRepoPath
} from "../../../scripts/check-public-api-tsdoc";

const oneSource = [
  {
    packageName: "example-package",
    entry: "packages/example/src/index.ts",
    tsconfig: "packages/example/tsconfig.json"
  }
] as const;

async function makeWorkspace({ withMissingSummary = false } = {}) {
  const root = await mkdtemp(join(tmpdir(), "check-public-api-tsdoc-"));
  await mkdir(join(root, "packages/example/src"), { recursive: true });

  await writeFile(
    join(root, "packages/example/tsconfig.json"),
    `${JSON.stringify(
      {
        compilerOptions: {
          target: "ES2020",
          module: "ESNext",
          moduleResolution: "Bundler",
          strict: true,
          skipLibCheck: true,
          noEmit: true
        },
        include: ["src"]
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  const maybeMissing = withMissingSummary
    ? "\nexport const undocumented = (value: number) => value * 2;\n"
    : "\n/** Multiplies by two. */\nexport const undocumented = (value: number) => value * 2;\n";

  await writeFile(
    join(root, "packages/example/src/index.ts"),
    `/** Adds one to the provided value. */
export const plusOne = (value: number) => value + 1;

export type Payload = {
  id: string;
};
${maybeMissing}`,
    "utf8"
  );

  return root;
}

describe("check-public-api-tsdoc script", () => {
  it("builds repo paths", () => {
    expect(toRepoPath("/repo", "a", "b")).toBe("/repo/a/b");
  });

  it("parses tsconfig", async () => {
    const root = await makeWorkspace();
    const parsed = parseTsConfig(join(root, "packages/example/tsconfig.json"));

    expect(
      parsed.fileNames.some((file: string) => file.endsWith("packages/example/src/index.ts"))
    ).toBe(true);

    await rm(root, { recursive: true, force: true });
  });

  it("collects no missing summaries when callable exports are documented", async () => {
    const root = await makeWorkspace();
    const missing = collectMissingTSDocForSource(oneSource[0], root);

    expect(missing).toEqual([]);

    await rm(root, { recursive: true, force: true });
  }, 10_000);

  it("collects missing summaries for callable exports", async () => {
    const root = await makeWorkspace({ withMissingSummary: true });
    const missing = collectMissingTSDocForSource(oneSource[0], root);

    expect(missing).toHaveLength(1);
    expect(missing[0]?.packageName).toBe("example-package");
    expect(missing[0]?.exportName).toBe("undocumented");

    await rm(root, { recursive: true, force: true });
  }, 10_000);

  it("check passes when docs are complete", async () => {
    const root = await makeWorkspace();
    const logs: string[] = [];

    const result = checkPublicApiTSDoc({
      repoRoot: root,
      sources: oneSource,
      log: (message: string) => logs.push(message)
    });

    expect(result).toEqual({ missing: [] });
    expect(logs).toEqual(["Public API TSDoc summaries are up to date."]);

    await rm(root, { recursive: true, force: true });
  });

  it("check fails when summaries are missing", async () => {
    const root = await makeWorkspace({ withMissingSummary: true });
    const errors: string[] = [];
    const exit = vi.fn();

    const result = checkPublicApiTSDoc({
      repoRoot: root,
      sources: oneSource,
      error: (message: string) => errors.push(message),
      exit
    });

    expect(result.missing).toHaveLength(1);
    expect(exit).toHaveBeenCalledWith(1);
    expect(errors[0]).toBe(
      "Public API TSDoc summaries are missing. Add JSDoc/TSDoc to these exports:"
    );
    expect(errors[1]).toContain("example-package#undocumented");

    await rm(root, { recursive: true, force: true });
  });

  it("check uses default exit handler when summaries are missing", async () => {
    const root = await makeWorkspace({ withMissingSummary: true });
    const exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation((code?: string | number | null) => {
        throw new Error(`exit:${code}`);
      });

    expect(() =>
      checkPublicApiTSDoc({
        repoRoot: root,
        sources: oneSource,
        error: () => {}
      })
    ).toThrow("exit:1");

    exitSpy.mockRestore();
    await rm(root, { recursive: true, force: true });
  });

  it("main delegates to checker", async () => {
    const root = await makeWorkspace();
    const logs: string[] = [];

    const result = main({
      repoRoot: root,
      sources: oneSource,
      log: (message: string) => logs.push(message)
    });

    expect(result).toEqual({ missing: [] });
    expect(logs).toEqual(["Public API TSDoc summaries are up to date."]);

    await rm(root, { recursive: true, force: true });
  });

  it("entrypoint detection handles all branches", () => {
    expect(isEntrypoint("", "file:///a/script.ts")).toBe(false);
    expect(isEntrypoint("/a/script.ts", "file:///a/script.ts")).toBe(true);
    expect(isEntrypoint("/a/other.ts", "file:///a/script.ts")).toBe(false);
  });

  it("resolves api tsdoc sources from filesystem, skipping private and malformed packages", async () => {
    const root = await mkdtemp(join(tmpdir(), "resolve-api-tsdoc-sources-"));

    const writePackage = async (
      dir: string,
      manifest: Record<string, unknown>,
      { withEntry = true, withTsconfig = true } = {}
    ) => {
      await mkdir(join(root, "packages", dir, "src"), { recursive: true });
      await writeFile(
        join(root, "packages", dir, "package.json"),
        `${JSON.stringify(manifest, null, 2)}\n`,
        "utf8"
      );
      if (withEntry) {
        await writeFile(join(root, "packages", dir, "src/index.ts"), "export {};\n", "utf8");
      }
      if (withTsconfig) {
        await writeFile(join(root, "packages", dir, "tsconfig.json"), "{}\n", "utf8");
      }
    };

    await writePackage("public-a", { name: "@scope/public-a" });
    await writePackage("public-b", { name: "@scope/public-b", private: false });
    await writePackage("private-one", { name: "@scope/private-one", private: true });
    await writePackage("nameless", { private: false });
    await writePackage("no-entry", { name: "@scope/no-entry" }, { withEntry: false });
    await writePackage("no-tsconfig", { name: "@scope/no-tsconfig" }, { withTsconfig: false });

    await mkdir(join(root, "packages", "malformed"), { recursive: true });
    await writeFile(join(root, "packages", "malformed", "package.json"), "{ not json", "utf8");

    await mkdir(join(root, "packages", "no-manifest"), { recursive: true });

    const sources = resolveApiTSDocSources(root);
    expect(sources.map((source) => source.packageName)).toEqual([
      "@scope/public-a",
      "@scope/public-b"
    ]);
    expect(sources[0]).toEqual({
      packageName: "@scope/public-a",
      entry: "packages/public-a/src/index.ts",
      tsconfig: "packages/public-a/tsconfig.json"
    });

    await rm(root, { recursive: true, force: true });
  });

  it("returns empty array when packages directory is missing", async () => {
    const root = await mkdtemp(join(tmpdir(), "resolve-api-tsdoc-sources-empty-"));
    expect(resolveApiTSDocSources(root)).toEqual([]);
    await rm(root, { recursive: true, force: true });
  });
});
