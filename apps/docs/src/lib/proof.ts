/**
 * The numbers the landing page claims, read from the things that enforce them.
 *
 * A marketing page that hardcodes "7.58 kB" is right until the day it is not,
 * and nothing tells you which day that was. Everything here is derived at build
 * time from a source of truth in the repo, so the page cannot drift from the
 * library it is describing.
 *
 * Bundle sizes are MEASURED, by running size-limit against each package's built
 * dist. size-limit compresses with brotli unless a check opts out with
 * `gzip: true` or `brotli: false` — none of ours do, so "brotlied" is accurate.
 *
 * The fallback, when a package has not been built, is that package's size-limit
 * *budget* — a ceiling rather than a measurement. It is reported as such
 * (`measured: false`, and the page renders it as "≤ 7.9 kB"), because quoting a
 * ceiling as though it were a measurement is the exact failure this file
 * exists to prevent. In a normal build the fallback should never fire: the docs
 * app depends on all three packages, so turbo's `^build` builds them first.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, parse } from "node:path";

/**
 * Walk up from the working directory to the workspace root.
 *
 * Not `import.meta.url`: Astro bundles this module into
 * `dist/.prerender/chunks/`, so at build time that resolves to the chunk's
 * location and a relative hop lands somewhere that does not exist. The cwd is
 * the docs package under both `astro build` and turbo, but its depth is not
 * something to hardcode either — so look for the file that marks the root.
 */
function findRepoRoot(from = process.cwd()) {
  let dir = from;
  const { root } = parse(dir);
  while (dir !== root) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;
    dir = dirname(dir);
  }
  throw new Error("proof.ts: could not locate the workspace root from " + from);
}

const REPO = findRepoRoot();

/** One entry of `size-limit --json` output. */
interface SizeLimitCheck {
  name: string;
  size: number;
  sizeLimit?: number;
  passed?: boolean;
}

/** A `size-limit` entry as declared in a package's package.json. */
interface SizeLimitBudget {
  name: string;
  limit: string;
}

export interface PackageSize {
  npm: string;
  label: string;
  note: string;
  /** False when the figure is a declared ceiling rather than a measurement. */
  measured: boolean;
  /** "7.58 kB" when measured, "≤ 7.9 kB" when falling back to the budget. */
  value: string;
  budget: string | null;
}

/** The one size-limit check per package that represents "the package". */
const PACKAGES = [
  {
    dir: "core",
    npm: "@rxova/journey-core",
    check: "core/createJourneyMachine",
    label: "Core, brotlied",
    note: "The whole framework-agnostic runtime, measured by size-limit"
  },
  {
    dir: "react",
    npm: "@rxova/journey-react",
    check: "react/createJourney",
    label: "React bindings",
    note: "Provider, step renderer and typed hooks"
  },
  {
    dir: "devtools-bridge",
    npm: "@rxova/journey-devtools-bridge",
    check: "devtools-bridge/attachJourneyDevtools",
    label: "DevTools bridge",
    note: "Opt-in — nothing reaches your bundle unless you attach it"
  }
];

const readJson = (path: string): Record<string, unknown> => JSON.parse(readFileSync(path, "utf8"));

/** kB to two decimals, the precision size-limit's own output supports. */
const toKb = (bytes: number) => `${(bytes / 1000).toFixed(2)} kB`;

/**
 * Run size-limit in a package and return its checks by name.
 *
 * stdout only: the bridge's bundle trips an esbuild `empty-import-meta` warning
 * on stderr, and mixing the two streams makes the JSON unparseable.
 */
function measure(dir: string): Map<string, SizeLimitCheck> | null {
  const cwd = join(REPO, "packages", dir);
  if (!existsSync(join(cwd, "dist"))) return null;
  try {
    const stdout = execFileSync("npx", ["--no-install", "size-limit", "--json"], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 120_000
    });
    const checks = JSON.parse(stdout) as SizeLimitCheck[];
    return new Map(checks.map((check) => [check.name, check]));
  } catch {
    // A missing build, a size-limit failure, or a non-JSON stdout all land
    // here, and all mean the same thing: fall back to the declared budget.
    return null;
  }
}

/**
 * Measured once per build process. Astro evaluates this module a single time,
 * but memoising keeps a dev server from re-running three bundlers on every HMR
 * round-trip. Set DOCS_MEASURE=0 to skip measuring entirely and take the
 * budgets — useful when iterating on copy and the packages are not built.
 */
let cache: PackageSize[] | undefined;

export function packageSizes(): PackageSize[] {
  if (cache) return cache;

  const skip = process.env.DOCS_MEASURE === "0";

  cache = PACKAGES.map((pkg): PackageSize => {
    const manifest = readJson(join(REPO, "packages", pkg.dir, "package.json"));
    const budgets = manifest["size-limit"] as SizeLimitBudget[] | undefined;
    const budget = budgets?.find((entry) => entry.name === pkg.check);
    const checks = skip ? null : measure(pkg.dir);
    const measured = checks?.get(pkg.check);

    return {
      npm: pkg.npm,
      label: pkg.label,
      note: pkg.note,
      measured: Boolean(measured),
      // "7.58 kB" when measured, "≤ 7.9 kB" when falling back to the budget.
      value: measured ? toKb(measured.size) : `≤ ${budget?.limit ?? "?"}`,
      budget: budget?.limit ?? null
    };
  });

  return cache;
}

/**
 * The per-file coverage floor CI enforces, read from the vitest config rather
 * than restated. Regex rather than importing the config: it is TypeScript and
 * pulls in the full vitest resolution chain, which is a lot of machinery to
 * learn four integers.
 */
export function coverageFloor(): Record<"statements" | "branches" | "functions" | "lines", number> {
  const source = readFileSync(join(REPO, "vitest.config.ts"), "utf8");
  const block = /thresholds:\s*\{([^}]*)\}/.exec(source)?.[1] ?? "";
  const read = (key: string) => Number(new RegExp(`${key}:\\s*(\\d+)`).exec(block)?.[1]);

  return {
    statements: read("statements"),
    branches: read("branches"),
    functions: read("functions"),
    lines: read("lines")
  };
}

/** Published packages, so "3" is counted rather than typed. */
export function packageCount() {
  return PACKAGES.length;
}
