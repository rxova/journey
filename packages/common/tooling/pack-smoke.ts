import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { assertIncludes, getExportEntries } from "./pack-smoke-helpers";

const repoRoot = resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const packagesDir = join(repoRoot, "packages");
const packDir = mkdtempSync(join(tmpdir(), "rxova-journey-pack-"));

type PackResultEntry = {
  filepath?: string;
  filename?: string;
};

const listTarFiles = (tarballPath: string): string[] =>
  execFileSync("tar", ["-tf", tarballPath], { encoding: "utf8" }).split("\n").filter(Boolean);

const readTarJson = (tarballPath: string, entryPath: string): unknown => {
  const raw = execFileSync("tar", ["-xOf", tarballPath, entryPath], { encoding: "utf8" });
  return JSON.parse(raw) as unknown;
};

const parsePackResult = (raw: string): PackResultEntry | PackResultEntry[] | null => {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  try {
    return JSON.parse(trimmed) as PackResultEntry | PackResultEntry[];
  } catch {
    const lines = trimmed.split("\n").filter(Boolean);
    for (let i = lines.length - 1; i >= 0; i -= 1) {
      const line = lines[i];
      if (line === undefined) {
        continue;
      }
      try {
        return JSON.parse(line) as PackResultEntry | PackResultEntry[];
      } catch {
        continue;
      }
    }
  }
  return null;
};

type PackedPackageJson = {
  exports?: {
    ".": unknown;
  };
};

const isPrivatePackage = (packageJsonPath: string): boolean => {
  try {
    const manifest = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
      private?: unknown;
    };
    return manifest.private === true;
  } catch {
    return false;
  }
};

const run = (): void => {
  const packages = readdirSync(packagesDir, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name)
    .filter((name) => existsSync(join(packagesDir, name, "package.json")))
    .filter((name) => !isPrivatePackage(join(packagesDir, name, "package.json")));

  try {
    for (const pkg of packages) {
      const pkgDir = join(packagesDir, pkg);
      const packOutput = execFileSync("pnpm", ["pack", "--json", "--pack-destination", packDir], {
        cwd: pkgDir,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "inherit"]
      });
      const result = parsePackResult(packOutput);
      const tarballEntry = Array.isArray(result) ? result?.[0] : result;
      const tarballName = tarballEntry?.filepath ?? tarballEntry?.filename;
      if (!tarballName) {
        throw new Error(`[pack-smoke] pnpm pack did not return a tarball for ${pkg}`);
      }

      const tarballPath = tarballName.startsWith("/") ? tarballName : join(packDir, tarballName);
      const files = listTarFiles(tarballPath);

      const requiredFiles = [
        "package/package.json",
        "package/README.md",
        "package/LICENSE",
        "package/dist/index.js",
        "package/dist/index.cjs",
        "package/dist/index.d.ts",
        "package/dist/index.d.cts"
      ];
      assertIncludes(files, requiredFiles, `${pkg} tarball`);

      const packedPackageJson = readTarJson(
        tarballPath,
        "package/package.json"
      ) as PackedPackageJson;
      const exportRoot = packedPackageJson?.exports?.["."];
      if (!exportRoot) {
        throw new Error(`[pack-smoke] ${pkg} tarball missing package.json exports["."]`);
      }

      const exportEntries = getExportEntries(exportRoot);
      assertIncludes(files, exportEntries, `${pkg} export targets`);
    }
  } finally {
    rmSync(packDir, { recursive: true, force: true });
  }
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run();
}
