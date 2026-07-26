import { spawnSync } from "node:child_process";
import process from "node:process";
import { pathToFileURL } from "node:url";

/** A gate step: either a package.json script, or one Turbo invocation. */
export type VerifyStep = {
  readonly name: string;
  readonly script?: string;
  readonly turbo?: readonly string[];
};

/** Just the part of spawnSync's result the runner reads. */
export type StepResult = { readonly status: number | null };

export type RunVerifyOptions = {
  log?: (message: string) => void;
  error?: (message: string) => void;
  run?: (step: VerifyStep) => StepResult;
};

/**
 * One ordered definition of "is this releasable", executed locally by the
 * pre-push hook. CI runs the same checks split across parallel jobs, so a green
 * push means a green pipeline.
 *
 * The point of a single list is that the local gate and CI cannot drift. Before
 * this existed there were two overlapping lists — a pre-commit hook that ran
 * lint-staged, a full format pass, the whole test suite with coverage, a
 * typecheck and the size budgets on *every commit*, and a `release:verify`
 * chain of twelve `pnpm run`s. The first was slow enough to invite
 * `--no-verify`; the second only ever ran in CI. Neither checked the audit or
 * the dependency dedupe.
 *
 * Ordered cheapest-and-most-likely-to-fail first, so a formatting slip surfaces
 * in a second rather than after the package tarballs are built.
 *
 * Every step is skip-cheap when nothing it reads has changed, and the skipping
 * is content-hashed, never git-diff based — Turbo hashes the files that feed
 * each task, and eslint/prettier key on file content plus config. A rebased or
 * cherry-picked tree that ends up byte-identical replays; one that does not
 * re-runs exactly the packages that differ. No git state can make it silently
 * under-check, which is the reason to prefer this over `--filter=[HEAD^1]`.
 */
export const steps: readonly VerifyStep[] = [
  { name: "Audit dependencies", script: "audit:check" },
  // Cached by Turbo on the lockfile + manifests (see turbo.json) rather than
  // run directly, which turns the slowest of the cheap steps into a replay
  // whenever the dependency graph is untouched.
  { name: "Check dependency dedupe", turbo: ["//#dedupe:check"] },
  { name: "Check formatting", script: "format:check" },
  { name: "Lint", script: "lint" },
  { name: "Check major version bumps", script: "version:major:check" },
  // Turbo already knows `^build` must precede typecheck, and that `build` must
  // precede size and check:exports, so handing it whole sets lets it parallelise
  // across the ten workspaces and pay the pnpm+turbo startup once per stage
  // rather than once per task.
  //
  // Unlike the sibling repos, the docs site is *not* excluded here: journey's
  // Starlight build renders no mermaid, so it needs no headless browser and a
  // fresh clone can run this hook without installing one.
  {
    name: "Docs, API surface and release notes",
    turbo: ["docs:api:check", "docs:release-notes:check"]
  },
  {
    name: "Typecheck and test",
    turbo: ["typecheck", "typecheck:tests", "test"]
  },
  {
    name: "Build, size budgets and package contracts",
    turbo: ["build", "size", "check:exports"]
  },
  // Last because it is the slowest, and a plain script rather than a Turbo
  // task: it reads the dist the step above produced, but a root task cannot
  // depend on a package task (see turbo.json). Ordering it here is what
  // guarantees the tarballs it inspects are the current ones.
  { name: "Pack smoke test", script: "pack:smoke" }
];

const runStep = (step: VerifyStep): StepResult =>
  step.turbo
    ? spawnSync("pnpm", ["exec", "turbo", "run", ...step.turbo], { stdio: "inherit" })
    : spawnSync("pnpm", ["run", step.script as string], { stdio: "inherit" });

export function runVerify({
  log = console.log,
  error = console.error,
  run = runStep
}: RunVerifyOptions = {}): number {
  for (const [index, step] of steps.entries()) {
    log(`\n[${index + 1}/${steps.length}] ${step.name}`);
    const result = run(step);
    if (result.status !== 0) {
      error(`\n✗ ${step.name} failed. Fix it and re-run \`pnpm run verify\`.`);
      return result.status ?? 1;
    }
  }

  log(`\n✓ all ${steps.length} stages passed`);
  return 0;
}

// Guarded: without this, importing the module to read `steps` or to exercise
// `runVerify` with a stubbed runner would execute the whole gate and then kill
// the test process. That is precisely what kept this file untested.
const isEntrypoint =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntrypoint) {
  process.exit(runVerify());
}
