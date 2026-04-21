import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const scriptPath = resolve(__dirname, "commitlint.ts");
const tsxLoaderPath = resolve(__dirname, "../../../node_modules/tsx/dist/loader.mjs");

function runScript(cwd: string): { stdout: string; status: number } {
  try {
    const stdout = execFileSync(process.execPath, ["--import", tsxLoaderPath, scriptPath], {
      encoding: "utf8",
      cwd
    });
    return { stdout, status: 0 };
  } catch (err: unknown) {
    const e = err as { stdout?: string; status?: number };
    return { stdout: e.stdout ?? "", status: e.status ?? 1 };
  }
}

describe("commitlint script", () => {
  it("exits 0 with a skip message when there is no git HEAD", () => {
    const cwd = mkdtempSync(join(tmpdir(), "commitlint-test-"));
    execFileSync("git", ["init"], { cwd, stdio: "ignore" });

    const { stdout, status } = runScript(cwd);

    expect(status).toBe(0);
    expect(stdout).toContain("No commits found yet");
  });
});
