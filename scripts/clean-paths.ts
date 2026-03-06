import { rmSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

export function cleanPaths(paths, cwd = process.cwd()) {
  for (const target of paths) {
    const absoluteTarget = path.resolve(cwd, target);
    rmSync(absoluteTarget, { recursive: true, force: true });
  }
}

function main(argv = process.argv.slice(2)) {
  if (argv.length === 0) {
    console.error("Usage: node ./scripts/clean-paths.ts <path> [<path>...]");
    process.exit(1);
  }

  cleanPaths(argv);
}

function isEntrypoint(entryArg = process.argv[1], moduleUrl = import.meta.url) {
  if (!entryArg) return false;
  return pathToFileURL(entryArg).href === moduleUrl;
}

if (isEntrypoint()) {
  main();
}
