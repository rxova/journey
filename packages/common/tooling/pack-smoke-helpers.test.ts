import { describe, expect, it } from "vitest";

import { assertIncludes, getExportEntries } from "./pack-smoke-helpers";

/**
 * pack-smoke.ts itself is not spawn-tested: it derives `repoRoot` from its own
 * location via import.meta.url, so running it in a throwaway directory still
 * points it at this repository. Its decision-making lives in these two helpers,
 * which is what gets covered instead — the export-map flattening in particular
 * is the part that silently under-checks if it stops recursing.
 */

describe("getExportEntries", () => {
  it("maps a string export to its packed path", () => {
    expect(getExportEntries("./dist/index.js")).toEqual(["package/dist/index.js"]);
  });

  it("flattens a subpath map", () => {
    expect(
      getExportEntries({
        ".": "./dist/index.js",
        "./react": "./dist/react.js"
      })
    ).toEqual(["package/dist/index.js", "package/dist/react.js"]);
  });

  it("collects the runtime targets of the shape this repo actually publishes", () => {
    // packages/core and friends use { types: { import, require }, import, require }.
    expect(
      getExportEntries({
        ".": {
          types: { import: "./dist/index.d.ts", require: "./dist/index.d.cts" },
          import: "./dist/index.js",
          require: "./dist/index.cjs"
        }
      })
    ).toEqual(["package/dist/index.js", "package/dist/index.cjs"]);
  });

  // KNOWN GAP, asserted so it cannot change unnoticed: the walk descends one
  // level into a condition object, so declaration paths nested under `types`
  // are never collected — and therefore never asserted against the tarball.
  // The root entry's .d.ts/.d.cts survive only because pack-smoke.ts lists them
  // explicitly in REQUIRED; a subpath export's declarations are unchecked.
  // Widening the walk to recurse fully would close it.
  it("does NOT collect declaration paths nested under a types condition", () => {
    expect(
      getExportEntries({
        "./analytics": {
          types: { import: "./dist/plugins/analytics/index.d.ts" },
          import: "./dist/plugins/analytics/index.js"
        }
      })
    ).toEqual(["package/dist/plugins/analytics/index.js"]);
  });

  it("returns nothing when every target sits two levels deep", () => {
    // The shape rxova/use-everywhere publishes; recorded for contrast.
    expect(
      getExportEntries({
        ".": {
          import: { types: "./dist/index.d.ts", default: "./dist/index.js" }
        }
      })
    ).toEqual([]);
  });

  it("collects a single level of nesting", () => {
    expect(
      getExportEntries({
        ".": { import: "./dist/index.js", require: "./dist/index.cjs" }
      })
    ).toEqual(["package/dist/index.js", "package/dist/index.cjs"]);
  });

  it("de-duplicates targets reached by more than one condition", () => {
    expect(
      getExportEntries({
        ".": { import: "./dist/index.js", default: "./dist/index.js" }
      })
    ).toEqual(["package/dist/index.js"]);
  });

  it("leaves a non-relative target alone", () => {
    expect(getExportEntries({ ".": "dist/index.js" })).toEqual(["dist/index.js"]);
  });

  it("returns nothing for null, undefined or a non-object", () => {
    expect(getExportEntries(null)).toEqual([]);
    expect(getExportEntries(undefined)).toEqual([]);
    expect(getExportEntries(42)).toEqual([]);
  });
});

describe("assertIncludes", () => {
  it("passes when every required entry is present", () => {
    expect(() => assertIncludes(["a", "b"], ["a"], "tarball")).not.toThrow();
  });

  it("passes on an empty requirement list", () => {
    expect(() => assertIncludes([], [], "tarball")).not.toThrow();
  });

  it("names every missing entry, and the context", () => {
    expect(() => assertIncludes(["a"], ["b", "c"], "tarball")).toThrow(
      /Missing tarball entries: b, c/
    );
  });
});
