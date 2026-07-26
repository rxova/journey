import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const docsRoots = [
  "README.md",
  "packages/core/README.md",
  "apps/docs/src/content/docs/core",
  "apps/docs/src/content/docs/react",
  "apps/docs/src/content/docs/bridge",
  "apps/docs/src/content/docs/devtool"
] as const;

const ignoredFiles = new Set([
  "apps/docs/src/content/docs/core/releases.md",
  "apps/docs/src/content/docs/react/releases.md",
  "apps/docs/src/content/docs/bridge/releases.md"
]);

const forbiddenPatterns = [
  {
    pattern: "updateStepMetadata",
    reason: "step metadata is not a mutable runtime API"
  },
  {
    pattern: "snapshot.stepMeta",
    reason: "step metadata is not part of the runtime snapshot"
  },
  {
    pattern: "running-effect",
    reason: "async phases no longer expose a running-effect state"
  },
  {
    pattern: "metadata.updated",
    reason: "there is no metadata.updated observation event"
  },
  {
    pattern: /`when`\s*\+\s*`effect`/u,
    reason: "transitions use when + updateContext, not effect"
  },
  {
    pattern: /guards? and effects?/iu,
    reason: "public docs should describe guards and synchronous context updates"
  },
  {
    pattern: /guard and effect/iu,
    reason: "public docs should describe guards and synchronous context updates"
  },
  {
    pattern: /transition effect/iu,
    reason: "public docs should not describe transition effects"
  },
  {
    pattern: /use `effect` on a transition/iu,
    reason: "public docs should point to updateContext or lifecycle callbacks instead"
  },
  {
    pattern: /type JOURNEY_STATUS/u,
    reason: "docs should only reference real exported types"
  }
] as const;

const collectMarkdownFiles = (entryPath: string): string[] => {
  const absolutePath = path.join(repoRoot, entryPath);
  const stats = statSync(absolutePath);
  if (stats.isFile()) {
    return [entryPath];
  }

  return readdirSync(absolutePath, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = path.join(entryPath, entry.name);
    if (entry.isDirectory()) {
      return collectMarkdownFiles(relativePath);
    }

    return entry.name.endsWith(".md") ? [relativePath] : [];
  });
};

describe("public docs contract", () => {
  it("does not describe removed runtime APIs or stale async phases", () => {
    const violations: string[] = [];
    const files = docsRoots
      .flatMap((entryPath) => collectMarkdownFiles(entryPath))
      .filter((filePath) => !ignoredFiles.has(filePath));

    for (const filePath of files) {
      const contents = readFileSync(path.join(repoRoot, filePath), "utf8");

      for (const { pattern, reason } of forbiddenPatterns) {
        const match =
          typeof pattern === "string" ? contents.includes(pattern) : pattern.test(contents);

        if (match) {
          violations.push(`${filePath}: ${reason}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
