import { execFile } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

/**
 * The build's dist check is the only thing standing between a packaging
 * regression and a green release, so it gets its own regression tests: each
 * case breaks one property of a synthetic dist and asserts the check names it
 * and fails the build. A healthy fixture must stay silent, or the check is
 * just noise.
 *
 * The script is spawned rather than imported so the artifacts load through
 * real Node resolution — the same path a consumer's bundler-free install
 * takes — and so the exit code CI depends on is what gets asserted.
 */

/** This file lives at <package>/test/, so the package root is one level up. */
const packageRoot = (): string => {
  const testPath = expect.getState().testPath;
  if (testPath === undefined) throw new Error("cannot locate the react package root");
  return join(dirname(testPath), "..");
};

const LINEAR_BODY = "() => ({ machine: { getSnapshot: () => ({ context: { ok: true } }) } })";
const GRAPH_BODY = "() => ({ send: () => {} })";

const healthyFiles = (): Record<string, string> => ({
  "index.js": `export const createLinearJourney = ${LINEAR_BODY};`,
  "index.cjs": `exports.createLinearJourney = ${LINEAR_BODY};`,
  "graph.js": `export const createGraphJourney = ${GRAPH_BODY};`,
  "graph.cjs": `exports.createGraphJourney = ${GRAPH_BODY};`,
  "client.js": `"use client";\nexport const createLinearJourney = ${LINEAR_BODY};`,
  "client.cjs": `"use client";\nexports.createLinearJourney = ${LINEAR_BODY};`,
  "index.d.ts": "export {};",
  "index.d.cts": "export {};",
  "graph.d.ts": "export {};",
  "graph.d.cts": "export {};",
  "client.d.ts": "export {};",
  "client.d.cts": "export {};"
});

const roots: string[] = [];

/** Writes a dist fixture; `null` in an override omits that file entirely. */
const makeDist = (overrides: Record<string, string | null> = {}): string => {
  const root = mkdtempSync(join(tmpdir(), "journey-smoke-"));
  roots.push(root);
  // dist/*.js is ESM only because the package declares it — mirror that.
  writeFileSync(join(root, "package.json"), JSON.stringify({ type: "module" }));
  const dist = join(root, "dist");
  mkdirSync(dist);
  for (const [name, content] of Object.entries({ ...healthyFiles(), ...overrides })) {
    if (content !== null) writeFileSync(join(dist, name), content);
  }
  return dist;
};

const runSmoke = (dist: string): Promise<{ code: number; output: string }> =>
  new Promise((resolve) => {
    const root = packageRoot();
    execFile(
      process.execPath,
      ["--import", "tsx", join(root, "scripts", "smoke.ts"), dist],
      { cwd: root },
      (error: Error | null, stdout: string, stderr: string) => {
        const code = error === null ? 0 : ((error as { code?: number }).code ?? 1);
        resolve({ code, output: `${stdout}${stderr}` });
      }
    );
  });

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("dist smoke check", () => {
  it("passes on a healthy dist", async () => {
    const { code, output } = await runSmoke(makeDist());
    expect(code).toBe(0);
    expect(output).toContain("dist entrypoints OK");
  });

  it("fails on a missing declaration file", async () => {
    const { code, output } = await runSmoke(makeDist({ "index.d.cts": null }));
    expect(code).toBe(1);
    expect(output).toContain("missing declaration file dist/index.d.cts");
  });

  it('fails when the "use client" directive is dropped', async () => {
    const { code, output } = await runSmoke(
      makeDist({ "client.js": `export const createLinearJourney = ${LINEAR_BODY};` })
    );
    expect(code).toBe(1);
    expect(output).toContain('dist/client.js lost its "use client" directive');
  });

  it("fails when an ESM entrypoint loses its export", async () => {
    const { code, output } = await runSmoke(makeDist({ "index.js": "export const nothing = 1;" }));
    expect(code).toBe(1);
    expect(output).toContain("dist/index.js does not export createLinearJourney");
  });

  it("fails when a CommonJS entrypoint loses its export", async () => {
    const { code, output } = await runSmoke(makeDist({ "graph.cjs": "exports.nothing = 1;" }));
    expect(code).toBe(1);
    expect(output).toContain("dist/graph.cjs does not export createGraphJourney");
  });

  it("fails when an entrypoint cannot be loaded at all", async () => {
    const { code, output } = await runSmoke(makeDist({ "graph.js": "this is not javascript" }));
    expect(code).toBe(1);
    expect(output).toContain("dist/graph.js failed to load");
  });

  it("fails when the graph entry merely re-exports the linear factory", async () => {
    const { code, output } = await runSmoke(
      makeDist({
        "graph.js": `export { createLinearJourney as createGraphJourney } from "./index.js";`
      })
    );
    expect(code).toBe(1);
    expect(output).toContain("re-exports the linear factory");
  });

  it("fails when a factory cannot build a working bundle", async () => {
    const { code, output } = await runSmoke(
      makeDist({
        "index.js": "export const createLinearJourney = () => { throw new Error('boom'); };"
      })
    );
    expect(code).toBe(1);
    expect(output).toContain("linear factory from dist threw: boom");
  });
});
