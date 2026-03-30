import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const scriptPath = resolve(__dirname, "../../../scripts/copy-types.ts");

const execNode = (args: string[]) =>
  new Promise<void>((resolvePromise, rejectPromise) => {
    execFile(process.execPath, ["--import", "tsx", ...args], (error) => {
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

    const dts = "export type Foo = { bar: string };\n//# sourceMappingURL=index.d.ts.map";
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

  it("creates .d.cts for .d.ts files in nested subdirectories", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "copy-types-nested-"));
    const distDir = join(tempRoot, "dist");
    const nestedDir = join(distDir, "plugins", "persistence");
    await mkdir(nestedDir, { recursive: true });

    const rootDts = "export type Root = {};\n//# sourceMappingURL=index.d.ts.map";
    const nestedDts = "export type Nested = {};\n//# sourceMappingURL=index.d.ts.map";

    await writeFile(join(distDir, "index.d.ts"), rootDts, "utf8");
    await writeFile(join(nestedDir, "index.d.ts"), nestedDts, "utf8");

    await execNode([scriptPath, distDir]);

    expect(existsSync(join(distDir, "index.d.cts"))).toBe(true);
    expect(existsSync(join(nestedDir, "index.d.cts"))).toBe(true);

    const nestedDcts = await readFile(join(nestedDir, "index.d.cts"), "utf8");
    expect(nestedDcts).toContain("sourceMappingURL=index.d.cts.map");

    await rm(tempRoot, { recursive: true, force: true });
  });

  it("replaces source map comments for file names containing regex metacharacters", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "copy-types-regex-name-"));
    const distDir = join(tempRoot, "dist");
    await mkdir(distDir, { recursive: true });

    const fileBaseName = "index[prod](1)+test";
    const dts = `export type Weird = {};\n//# sourceMappingURL=${fileBaseName}.d.ts.map`;
    const dtsMap = JSON.stringify({
      version: 3,
      file: `${fileBaseName}.d.ts`,
      sources: [],
      names: [],
      mappings: ""
    });

    await writeFile(join(distDir, `${fileBaseName}.d.ts`), dts, "utf8");
    await writeFile(join(distDir, `${fileBaseName}.d.ts.map`), dtsMap, "utf8");

    await execNode([scriptPath, distDir]);

    const dcts = await readFile(join(distDir, `${fileBaseName}.d.cts`), "utf8");
    expect(dcts).toContain(`sourceMappingURL=${fileBaseName}.d.cts.map`);

    const map = JSON.parse(await readFile(join(distDir, `${fileBaseName}.d.cts.map`), "utf8"));
    expect(map.file).toBe(`${fileBaseName}.d.cts`);

    await rm(tempRoot, { recursive: true, force: true });
  });
});
