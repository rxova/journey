import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { assertIncludes, getExportEntries } from "./pack-smoke-helpers.mjs";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const packagesDir = join(repoRoot, "packages");
const packDir = mkdtempSync(join(tmpdir(), "rxova-journey-pack-"));

const listTarFiles = (tarballPath) =>
  execFileSync("tar", ["-tf", tarballPath], { encoding: "utf8" }).split("\n").filter(Boolean);

const readTarJson = (tarballPath, entryPath) => {
  const raw = execFileSync("tar", ["-xOf", tarballPath, entryPath], { encoding: "utf8" });
  return JSON.parse(raw);
};

const run = () => {
  const packages = readdirSync(packagesDir, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name)
    .filter((name) => existsSync(join(packagesDir, name, "package.json")));

  try {
    for (const pkg of packages) {
      const pkgDir = join(packagesDir, pkg);
      const packOutput = execFileSync("pnpm", ["pack", "--json", "--pack-destination", packDir], {
        cwd: pkgDir,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "inherit"]
      });
      const parsePackResult = (raw) => {
        const trimmed = raw.trim();
        if (!trimmed) {
          return null;
        }
        try {
          return JSON.parse(trimmed);
        } catch {
          const lines = trimmed.split("\n").filter(Boolean);
          for (let i = lines.length - 1; i >= 0; i -= 1) {
            try {
              return JSON.parse(lines[i]);
            } catch {
              continue;
            }
          }
        }
        return null;
      };
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

      const packedPackageJson = readTarJson(tarballPath, "package/package.json");
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

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  run();
}
