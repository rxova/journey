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
  toRepoPath
} from "../../../scripts/check-public-api-tsdoc";

/**
 * Each case that calls into the checker builds a real TypeScript program, which
 * costs seconds of CPU. vitest runs this file concurrently with ~66 others, so
 * the default 5s budget passes in isolation and times out under load — a flake
 * that predates the pnpm 11 upgrade and was seen on pnpm 10 too. One generous
 * budget for every tsc-backed case rather than per-test guesses.
 */
const TSC_TIMEOUT_MS = 60_000;

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

  it(
    "collects no missing summaries when callable exports are documented",
    async () => {
      const root = await makeWorkspace();
      const missing = collectMissingTSDocForSource(oneSource[0], root);

      expect(missing).toEqual([]);

      await rm(root, { recursive: true, force: true });
    },
    TSC_TIMEOUT_MS
  );

  it(
    "collects missing summaries for callable exports",
    async () => {
      const root = await makeWorkspace({ withMissingSummary: true });
      const missing = collectMissingTSDocForSource(oneSource[0], root);

      expect(missing).toHaveLength(1);
      expect(missing[0]?.packageName).toBe("example-package");
      expect(missing[0]?.exportName).toBe("undocumented");

      await rm(root, { recursive: true, force: true });
    },
    TSC_TIMEOUT_MS
  );

  it(
    "check passes when docs are complete",
    async () => {
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
    },
    TSC_TIMEOUT_MS
  );

  it(
    "check fails when summaries are missing",
    async () => {
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
    },
    TSC_TIMEOUT_MS
  );

  it(
    "check uses default exit handler when summaries are missing",
    async () => {
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
    },
    TSC_TIMEOUT_MS
  );

  it(
    "main delegates to checker",
    async () => {
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
    },
    TSC_TIMEOUT_MS
  );

  it("entrypoint detection handles all branches", () => {
    expect(isEntrypoint("", "file:///a/script.ts")).toBe(false);
    expect(isEntrypoint("/a/script.ts", "file:///a/script.ts")).toBe(true);
    expect(isEntrypoint("/a/other.ts", "file:///a/script.ts")).toBe(false);
  });
});
