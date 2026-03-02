import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const scriptPath = resolve(__dirname, "../../../scripts/copy-types.mjs");

const execNode = (args: string[]) =>
  new Promise<void>((resolvePromise, rejectPromise) => {
    execFile(process.execPath, args, (error) => {
      if (error) {
        rejectPromise(error);
        return;
      }
      resolvePromise();
    });
  });

describe("copy-types script", () => {
  it("creates .d.cts and map from .d.ts", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "copy-types-"));
    const distDir = join(tempRoot, "dist");
    await mkdir(distDir, { recursive: true });

    const dts = "export type Foo = { bar: string };\\n//# sourceMappingURL=index.d.ts.map";
    const dtsMap = JSON.stringify({
      version: 3,
      file: "index.d.ts",
      sources: [],
      names: [],
      mappings: ""
    });

    await writeFile(join(distDir, "index.d.ts"), dts, "utf8");
    await writeFile(join(distDir, "index.d.ts.map"), dtsMap, "utf8");

    await execNode([scriptPath, distDir]);

    const dctsPath = join(distDir, "index.d.cts");
    const dctsMapPath = join(distDir, "index.d.cts.map");

    expect(existsSync(dctsPath)).toBe(true);
    expect(existsSync(dctsMapPath)).toBe(true);

    const dcts = await readFile(dctsPath, "utf8");
    expect(dcts).toContain("sourceMappingURL=index.d.cts.map");

    const map = JSON.parse(await readFile(dctsMapPath, "utf8"));
    expect(map.file).toBe("index.d.cts");

    await rm(tempRoot, { recursive: true, force: true });
  });
});
