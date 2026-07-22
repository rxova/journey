import { spawnSync } from "node:child_process";
import process from "node:process";
import { pathToFileURL } from "node:url";

export type ReleaseVerifyStep = {
  name: string;
  script: string;
};

export type RunScriptResult = {
  error?: Error;
  status: number | null;
};

export type RunScript = (script: string) => RunScriptResult;

export type ReleaseVerifyOptions = {
  error?: (value: unknown) => void;
  log?: (message: string) => void;
  runScript?: RunScript;
  steps?: readonly ReleaseVerifyStep[];
};

export const releaseVerifySteps: readonly ReleaseVerifyStep[] = [
  // First because it is cheap and because the publish path runs only this
  // script: keeping the audit in the CI workflow alone meant a release on main
  // could publish dependencies that a pull request would have been blocked on.
  { name: "Audit dependencies", script: "audit:check" },
  { name: "Check package major versions", script: "version:major:check" },
  { name: "Check dependency dedupe", script: "dedupe:check" },
  { name: "Check formatting", script: "format:check" },
  { name: "Lint", script: "lint" },
  { name: "Check public API TSDoc", script: "docs:api:check" },
  { name: "Check docs release notes", script: "docs:release-notes:check" },
  { name: "Build docs", script: "docs:check" },
  { name: "Typecheck packages and apps", script: "packages:typecheck" },
  { name: "Run tests", script: "test" },
  { name: "Check per-file package coverage", script: "packages:coverage" },
  { name: "Check package publishing metadata", script: "packaging:check" },
  { name: "Smoke-test package tarballs", script: "pack:smoke" },
  { name: "Build examples", script: "examples:build" },
  { name: "Check package size limits", script: "size:check" }
];

const runPnpmScript: RunScript = (script) =>
  spawnSync("pnpm", ["run", script], {
    stdio: "inherit"
  });

export const runReleaseVerify = ({
  error = console.error,
  log = console.log,
  runScript = runPnpmScript,
  steps = releaseVerifySteps
}: ReleaseVerifyOptions = {}): number => {
  for (const step of steps) {
    log(`\n==> ${step.name}`);
    const result = runScript(step.script);

    if (result.error) {
      error(result.error);
      return 1;
    }

    if (result.status !== 0) {
      return result.status ?? 1;
    }
  }

  return 0;
};

export const isEntrypoint = (
  entryArg: string | undefined = process.argv[1],
  moduleUrl = import.meta.url
): boolean => {
  if (!entryArg) return false;
  return pathToFileURL(entryArg).href === moduleUrl;
};

if (isEntrypoint()) {
  process.exitCode = runReleaseVerify();
}
