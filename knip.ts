import type { KnipConfig } from "knip";

/**
 * Unused files, exports and dependencies, as a gate rather than a report.
 *
 * The `export` keyword is the point: an export nothing imports still has to be
 * kept working, still shows up in editor completions, and still reads as part
 * of the contract. Nothing else in this repository notices one.
 *
 * Entry points are inferred from each package's manifest, so what follows is
 * only what inference cannot know — every entry a place where a file is reached
 * by something other than a TypeScript import.
 */
export default {
  // Advice nobody has to act on is advice that stops being read.
  treatConfigHintsAsErrors: true,
  // The root `packages:coverage` script is `pnpm -r … coverage`, which runs each
  // workspace's own `coverage` script. Knip reads the trailing word as a binary
  // and looks for a package named `coverage`.
  ignoreBinaries: ["coverage"],
  ignoreDependencies: [
    // Both are invoked as binaries from each publishable package's own
    // `check:exports` / `attw` script and resolved from the root's
    // `node_modules/.bin`, so the declaration belongs here while the use is a
    // workspace down. Knip matches the two up only within one workspace.
    "publint",
    "@arethetypeswrong/cli",
    // Named in typedoc.core.json / typedoc.react.json / typedoc.bridge.json as
    // a `plugin` entry. Knip does not read a typedoc config.
    "typedoc-plugin-markdown"
  ],
  workspaces: {
    "apps/docs": {
      // Neither is imported: src/lib/proof.ts reads `packages/<dir>/dist` from
      // disk to print each package's real bundle size, and falls back to the
      // declared budget when the dist is absent. Declaring them is what puts
      // them ahead of the docs in Turbo's `^build` order, so the published page
      // reports a measurement rather than a ceiling.
      ignoreDependencies: ["@rxova/journey-react", "@rxova/journey-devtools-bridge"],
      ignore: [
        // A one-shot Docusaurus-to-Starlight migration, deliberately kept: its
        // own header says it stays so "the transforms it applied are auditable
        // next to the diff they produced". Dead by design, not by accident.
        "scripts/migrate-content.js"
      ]
    },
    // Every example is a standalone, copy-me artefact: it is read and pasted,
    // not imported. Two consequences knip cannot infer:
    //
    //  - `src/demo/fixtures/*` is one small support kit, duplicated verbatim
    //    into each example so that copying one directory gives you something
    //    that runs. Each example uses some of it, so trimming a copy down to
    //    what that example happens to call would desynchronise the copies —
    //    which is the opposite of what makes them readable side by side.
    //  - `src/types.ts` and `src/journey.ts` are the shape being taught. Their
    //    own headers say so ("One declaration point for this journey's types"),
    //    and a reader imports from them even where the example itself does not.
    //
    // Everything else under `src` is still checked: an orphaned example file,
    // or a dependency an example stopped using, is real rot and still reported.
    // The twelve examples that carry the support kit. The three that do not
    // (core-quickstart-graph, react-showcase-linear and the graph showcase
    // below) are left out rather than globbed over, so a pattern that stops
    // matching is reported instead of quietly covering nothing.
    "examples/*-plugin-*": {
      entry: ["src/demo/fixtures/*.ts"]
    },
    "examples/core-showcase-*": {
      entry: ["src/demo/fixtures/*.ts"]
    },
    "examples/react-showcase-graph": {
      entry: ["src/types.ts", "src/journey.ts"]
    },
    // Type-level suites: files of `expectTypeOf`-style assertions that nothing
    // imports, because the assertion *is* the test and `tsc --noEmit` is what
    // runs it. A missing entry here would report the whole suite as dead code.
    "packages/core": {
      entry: ["src/**/__tests__/*.type.ts"]
    },
    "packages/react": {
      entry: ["src/**/__tests__/*.type.ts"]
    }
  }
} satisfies KnipConfig;
