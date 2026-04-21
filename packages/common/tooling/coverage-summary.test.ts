import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const scriptPath = resolve(__dirname, "coverage-summary.ts");
const tsxLoaderPath = resolve(__dirname, "../../../node_modules/tsx/dist/loader.mjs");

const SAMPLE_SUMMARY = JSON.stringify({
  total: {
    lines: { pct: 98.74 },
    branches: { pct: 97.12 },
    functions: { pct: 98.09 },
    statements: { pct: 98.68 }
  }
});

const runScript = (
  cwd: string,
  env?: Record<string, string>
): { stdout: string; status: number } => {
  try {
    const stdout = execFileSync(process.execPath, ["--import", tsxLoaderPath, scriptPath], {
      encoding: "utf8",
      cwd,
      env: { ...process.env, GITHUB_STEP_SUMMARY: "", ...env }
    });
    return { stdout, status: 0 };
  } catch (err: unknown) {
    const e = err as { stdout?: string; status?: number };
    return { stdout: e.stdout ?? "", status: e.status ?? 1 };
  }
};

describe("coverage-summary script", () => {
  it("exits 0 silently when coverage-summary.json does not exist", () => {
    const cwd = mkdtempSync(join(tmpdir(), "cov-summary-"));
    const result = runScript(cwd);
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("");
  });

  it("writes formatted markdown to stdout when GITHUB_STEP_SUMMARY is not set", () => {
    const cwd = mkdtempSync(join(tmpdir(), "cov-summary-"));
    mkdirSync(join(cwd, "coverage"));
    writeFileSync(join(cwd, "coverage/coverage-summary.json"), SAMPLE_SUMMARY);
    const result = runScript(cwd);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("## Coverage");
    expect(result.stdout).toContain("Lines: 98.74%");
    expect(result.stdout).toContain("Branches: 97.12%");
    expect(result.stdout).toContain("Functions: 98.09%");
    expect(result.stdout).toContain("Statements: 98.68%");
  });

  it("appends to GITHUB_STEP_SUMMARY file when the env var points to a file", () => {
    const cwd = mkdtempSync(join(tmpdir(), "cov-summary-"));
    mkdirSync(join(cwd, "coverage"));
    writeFileSync(join(cwd, "coverage/coverage-summary.json"), SAMPLE_SUMMARY);
    const summaryFile = join(cwd, "step-summary.md");
    writeFileSync(summaryFile, "");
    runScript(cwd, { GITHUB_STEP_SUMMARY: summaryFile });
    const written = readFileSync(summaryFile, "utf8");
    expect(written).toContain("## Coverage");
    expect(written).toContain("Lines: 98.74%");
  });
});
