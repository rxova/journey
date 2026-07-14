import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { cleanPaths } from "../clean-paths";

const scriptPath = resolve(__dirname, "../clean-paths.ts");
const tsxLoaderPath = resolve(__dirname, "../../../../node_modules/tsx/dist/loader.mjs");

const execNode = (args: string[]): { stdout: string; stderr: string; status: number } => {
  try {
    const stdout = execFileSync(process.execPath, ["--import", tsxLoaderPath, ...args], {
      encoding: "utf8"
    });
    return { stdout, stderr: "", status: 0 };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; status?: number };
    return { stdout: e.stdout ?? "", stderr: e.stderr ?? "", status: e.status ?? 1 };
  }
};

describe("cleanPaths", () => {
  it("removes a directory", () => {
    const root = mkdtempSync(join(tmpdir(), "clean-paths-test-"));
    const dir = join(root, "to-remove");
    mkdirSync(dir);
    cleanPaths([dir]);
    expect(() => mkdirSync(dir)).not.toThrow();
  });

  it("removes multiple paths", () => {
    const root = mkdtempSync(join(tmpdir(), "clean-paths-test-"));
    const a = join(root, "a");
    const b = join(root, "b");
    mkdirSync(a);
    writeFileSync(b, "content");
    cleanPaths([a, b]);
    expect(() => mkdirSync(a)).not.toThrow();
    expect(() => writeFileSync(b, "x")).not.toThrow();
  });

  it("is a no-op for non-existent paths", () => {
    expect(() => cleanPaths(["/tmp/does-not-exist-xyz-abc"])).not.toThrow();
  });

  it("resolves paths relative to cwd", () => {
    const root = mkdtempSync(join(tmpdir(), "clean-paths-test-"));
    mkdirSync(join(root, "sub"));
    cleanPaths(["sub"], root);
    expect(() => mkdirSync(join(root, "sub"))).not.toThrow();
  });
});

describe("clean-paths CLI", () => {
  it("exits 1 with usage message when called with no arguments", () => {
    const result = execNode([scriptPath]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Usage:");
  });

  it("removes a directory when called with a path argument", () => {
    const root = mkdtempSync(join(tmpdir(), "clean-paths-cli-"));
    const target = join(root, "remove-me");
    mkdirSync(target);
    const result = execNode([scriptPath, target]);
    expect(result.status).toBe(0);
    expect(() => mkdirSync(target)).not.toThrow();
  });
});
