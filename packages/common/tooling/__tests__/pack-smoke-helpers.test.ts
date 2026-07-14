import { describe, expect, it } from "vitest";

import { assertIncludes, getExportEntries } from "../pack-smoke-helpers";

describe("getExportEntries", () => {
  it("returns a package-prefixed path for a string starting with ./", () => {
    expect(getExportEntries("./dist/index.js")).toEqual(["package/dist/index.js"]);
  });

  it("returns a string unchanged when it does not start with ./", () => {
    expect(getExportEntries("dist/index.js")).toEqual(["dist/index.js"]);
  });

  it("collects flat string values from an export condition map", () => {
    const entries = getExportEntries({ import: "./dist/index.js", require: "./dist/index.cjs" });
    expect(entries.sort()).toEqual(["package/dist/index.cjs", "package/dist/index.js"].sort());
  });

  it("collects strings from one level of nested condition objects", () => {
    const entries = getExportEntries({
      types: { import: "./dist/index.d.ts", require: "./dist/index.d.cts" },
      import: "./dist/index.js"
    });
    expect(entries.sort()).toEqual(
      ["package/dist/index.d.cts", "package/dist/index.d.ts", "package/dist/index.js"].sort()
    );
  });

  it("deduplicates repeated paths", () => {
    const entries = getExportEntries({ a: "./dist/index.js", b: "./dist/index.js" });
    expect(entries).toEqual(["package/dist/index.js"]);
  });

  it("returns an empty array for an empty object", () => {
    expect(getExportEntries({})).toEqual([]);
  });

  it("ignores non-string, non-record values at the top level", () => {
    expect(getExportEntries(null)).toEqual([]);
    expect(getExportEntries(42)).toEqual([]);
    expect(getExportEntries(undefined)).toEqual([]);
  });

  it("ignores non-string values inside a record", () => {
    const entries = getExportEntries({ a: null, b: 42, c: "./dist/index.js" });
    expect(entries).toEqual(["package/dist/index.js"]);
  });

  it("does not recurse beyond two levels", () => {
    const entries = getExportEntries({
      outer: { inner: { deep: "./dist/deep.js" } }
    });
    expect(entries).toEqual([]);
  });
});

describe("assertIncludes", () => {
  it("does not throw when all required entries are present", () => {
    expect(() => assertIncludes(["a", "b", "c"], ["a", "c"], "exports")).not.toThrow();
  });

  it("does not throw when required array is empty", () => {
    expect(() => assertIncludes([], [], "exports")).not.toThrow();
  });

  it("throws listing the single missing entry", () => {
    expect(() => assertIncludes(["a", "b"], ["a", "c"], "exports")).toThrow(
      "[pack-smoke] Missing exports entries: c"
    );
  });

  it("throws listing all missing entries", () => {
    expect(() => assertIncludes(["a"], ["b", "c"], "exports")).toThrow(
      "[pack-smoke] Missing exports entries: b, c"
    );
  });

  it("includes the context label in the error message", () => {
    expect(() => assertIncludes([], ["x"], "dist files")).toThrow("Missing dist files entries");
  });
});
