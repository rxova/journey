import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const scriptPath = resolve(__dirname, "./check-package-major-versions.ts");
const tsxLoaderPath = resolve(__dirname, "../../../node_modules/tsx/dist/loader.mjs");

const runScript = (cwd: string) => {
  try {
    execFileSync(process.execPath, ["--import", tsxLoaderPath, scriptPath], {
      cwd,
      stdio: "pipe",
      encoding: "utf8"
    });
    return { code: 0 };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    const stderr = [error?.stderr?.toString(), error?.stdout?.toString()]
      .filter((value): value is string => Boolean(value))
      .join("\n");
    return { code: error?.status ?? 1, stderr };
  }
};

const writePackageJson = async (
  root: string,
  relativeDir: string,
  name: string,
  version: string
) => {
  const packageDir = join(root, relativeDir);
  await mkdir(packageDir, { recursive: true });
  await writeFile(
    join(packageDir, "package.json"),
    JSON.stringify({ name, version }, null, 2),
    "utf8"
  );
};

describe("check-package-major-versions script", () => {
  it("passes when package majors are aligned", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "check-package-major-versions-"));
    await writePackageJson(tempRoot, "packages/core", "@rxova/journey-core", "0.6.0");
    await writePackageJson(tempRoot, "packages/react", "@rxova/journey-react", "0.6.5");
    await writePackageJson(
      tempRoot,
      "packages/devtools-bridge",
      "@rxova/journey-devtools-bridge",
      "0.6.2"
    );

    const result = runScript(tempRoot);
    expect(result.code).toBe(0);
    await rm(tempRoot, { recursive: true, force: true });
  });

  it("fails when package majors diverge", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "check-package-major-versions-"));
    await writePackageJson(tempRoot, "packages/core", "@rxova/journey-core", "0.6.0");
    await writePackageJson(tempRoot, "packages/react", "@rxova/journey-react", "1.0.0");
    await writePackageJson(
      tempRoot,
      "packages/devtools-bridge",
      "@rxova/journey-devtools-bridge",
      "0.6.2"
    );

    const result = runScript(tempRoot);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("major versions must match");
    await rm(tempRoot, { recursive: true, force: true });
  });
});
