import { rmSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

export const cleanPaths = (paths: readonly string[], cwd = process.cwd()): void => {
  for (const target of paths) {
    const absoluteTarget = path.resolve(cwd, target);
    rmSync(absoluteTarget, { recursive: true, force: true });
  }
};

const main = (argv = process.argv.slice(2)): void => {
  if (argv.length === 0) {
    console.error("Usage: node ./packages/common/tooling/clean-paths.ts <path> [<path>...]");
    process.exit(1);
  }

  cleanPaths(argv);
};

const isEntrypoint = (entryArg = process.argv[1], moduleUrl = import.meta.url): boolean => {
  if (!entryArg) return false;
  return pathToFileURL(entryArg).href === moduleUrl;
};

if (isEntrypoint()) {
  main();
}
