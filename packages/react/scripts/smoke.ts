import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

/**
 * Post-build smoke check against the real dist/ output. The test suite runs
 * against source aliases, so an exports-map or bundling regression would
 * otherwise ship green: this loads every published entrypoint in both module
 * systems and exercises the factories once.
 *
 * `inspectDist` returns the problems it found instead of exiting, so its own
 * checks are testable against synthetic dist fixtures (see smoke.test.ts).
 */

const DECLARATION_FILES = [
  "index.d.ts",
  "index.d.cts",
  "graph.d.ts",
  "graph.d.cts",
  "client.d.ts",
  "client.d.cts"
] as const;

const CJS_ENTRYPOINTS = [
  ["index.cjs", "createLinearJourney"],
  ["graph.cjs", "createGraphJourney"],
  ["client.cjs", "createLinearJourney"]
] as const;

type Module = Record<string, unknown>;
type LinearProbe = { machine: { getSnapshot: () => { context: Record<string, unknown> } } };

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export const inspectDist = async (dist: string): Promise<string[]> => {
  const problems: string[] = [];

  for (const file of DECLARATION_FILES) {
    if (!existsSync(join(dist, file))) problems.push(`missing declaration file dist/${file}`);
  }

  // The client entry must keep its directive — a bundler config change could
  // silently drop it and break Next.js App Router consumers.
  for (const file of ["client.js", "client.cjs"]) {
    const path = join(dist, file);
    if (!existsSync(path)) {
      problems.push(`missing dist/${file}`);
      continue;
    }
    if (!readFileSync(path, "utf8").slice(0, 200).includes('"use client"')) {
      problems.push(`dist/${file} lost its "use client" directive`);
    }
  }

  const loadEsm = async (file: string): Promise<Module | null> => {
    try {
      return (await import(pathToFileURL(join(dist, file)).href)) as Module;
    } catch (error) {
      problems.push(`dist/${file} failed to load as ESM: ${messageOf(error)}`);
      return null;
    }
  };

  const exportsFunction = (module: Module | null, name: string, label: string): boolean => {
    if (module === null) return false;
    if (typeof module[name] !== "function") {
      problems.push(`${label} does not export ${name}`);
      return false;
    }
    return true;
  };

  const index = await loadEsm("index.js");
  const graph = await loadEsm("graph.js");
  const client = await loadEsm("client.js");

  const hasLinear = exportsFunction(index, "createLinearJourney", "dist/index.js");
  const hasGraph = exportsFunction(graph, "createGraphJourney", "dist/graph.js");
  exportsFunction(client, "createLinearJourney", "dist/client.js");

  const require = createRequire(import.meta.url);
  for (const [file, name] of CJS_ENTRYPOINTS) {
    try {
      exportsFunction(require(join(dist, file)) as Module, name, `dist/${file}`);
    } catch (error) {
      problems.push(`dist/${file} failed to load as CommonJS: ${messageOf(error)}`);
    }
  }

  if (hasLinear && hasGraph && index?.createLinearJourney === graph?.createGraphJourney) {
    problems.push("dist/graph.js re-exports the linear factory");
  }

  // The built factories actually run against the built core.
  if (hasLinear) {
    try {
      const bundle = (index?.createLinearJourney as (definition: unknown) => LinearProbe)({
        context: { ok: true },
        steps: ["a", "b"]
      });
      if (bundle.machine.getSnapshot().context.ok !== true) {
        problems.push("linear bundle from dist produced an unexpected snapshot");
      }
    } catch (error) {
      problems.push(`linear factory from dist threw: ${messageOf(error)}`);
    }
  }

  if (hasGraph) {
    try {
      const bundle = (graph?.createGraphJourney as (definition: unknown) => { send: unknown })({
        steps: { a: {}, b: {} },
        transitions: { GO: { from: "a", to: "b" } },
        initial: "a",
        context: {}
      });
      if (typeof bundle.send !== "function") problems.push("graph bundle from dist lacks send");
    } catch (error) {
      problems.push(`graph factory from dist threw: ${messageOf(error)}`);
    }
  }

  return problems;
};

const entryPath = process.argv[1];
const runAsScript =
  entryPath !== undefined && pathToFileURL(entryPath).href === import.meta.url.replace(/\?.*$/, "");

if (runAsScript) {
  // An explicit dist path lets the CLI contract (messages, exit code) be
  // tested against fixture dists; the build passes none and checks its own.
  const target = process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), "..", "dist");
  const problems = await inspectDist(target);
  for (const problem of problems) console.error(`[smoke] ${problem}`);
  if (problems.length > 0) process.exit(1);
  console.log("[smoke] dist entrypoints OK");
}
