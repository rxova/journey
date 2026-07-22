import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

/**
 * Post-build smoke check against the real dist/ output. The test suite runs
 * against source aliases, so an exports-map or bundling regression would
 * otherwise ship green: this loads every published entrypoint in both module
 * systems and exercises the factories once.
 */
const dist = join(dirname(fileURLToPath(import.meta.url)), "..", "dist");

const fail = (message: string): never => {
  console.error(`[smoke] ${message}`);
  process.exit(1);
};

const declarationFiles = [
  "index.d.ts",
  "index.d.cts",
  "graph.d.ts",
  "graph.d.cts",
  "client.d.ts",
  "client.d.cts"
];
for (const file of declarationFiles) {
  if (!existsSync(join(dist, file))) fail(`missing declaration file dist/${file}`);
}

// The client entry must keep its directive — a bundler config change could
// silently drop it and break Next.js App Router consumers.
for (const file of ["client.js", "client.cjs"]) {
  if (!readFileSync(join(dist, file), "utf8").slice(0, 200).includes('"use client"')) {
    fail(`dist/${file} lost its "use client" directive`);
  }
}

const esm = async (file: string): Promise<Record<string, unknown>> =>
  (await import(pathToFileURL(join(dist, file)).href)) as Record<string, unknown>;

const index = await esm("index.js");
const graph = await esm("graph.js");
const client = await esm("client.js");
if (typeof index.createLinearJourney !== "function") {
  fail("dist/index.js does not export createLinearJourney");
}
if (typeof graph.createGraphJourney !== "function") {
  fail("dist/graph.js does not export createGraphJourney");
}
if (typeof client.createLinearJourney !== "function") {
  fail("dist/client.js does not re-export createLinearJourney");
}

const require = createRequire(import.meta.url);
const cjsExpectations: readonly (readonly [string, string])[] = [
  ["index.cjs", "createLinearJourney"],
  ["graph.cjs", "createGraphJourney"],
  ["client.cjs", "createLinearJourney"]
];
for (const [file, name] of cjsExpectations) {
  const mod = require(join(dist, file)) as Record<string, unknown>;
  if (typeof mod[name] !== "function") fail(`dist/${file} does not export ${name}`);
}

// The built factories actually run against the built core.
const linear = (
  index.createLinearJourney as (definition: unknown) => {
    machine: { getSnapshot: () => { context: { ok: boolean } } };
  }
)({ context: { ok: true }, steps: ["a", "b"] });
if (linear.machine.getSnapshot().context.ok !== true) {
  fail("linear bundle from dist failed to produce a snapshot");
}

const checkout = (
  index.createLinearJourney === graph.createGraphJourney
    ? fail("graph entry re-exports the linear factory")
    : graph.createGraphJourney
) as (definition: unknown) => { send: unknown };
if (
  typeof checkout({
    steps: { a: {}, b: {} },
    transitions: { GO: { from: "a", to: "b" } },
    initial: "a",
    context: {}
  }).send !== "function"
) {
  fail("graph bundle from dist lacks send");
}

console.log("[smoke] dist entrypoints OK");
