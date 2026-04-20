import { describe, expect, it } from "vitest";

import { assertIncludes, getExportEntries } from "../tooling/pack-smoke-helpers";

describe("pack-smoke helpers", () => {
  it("collects export entries from string exports", () => {
    const entries = getExportEntries("./dist/index.js");
    expect(entries).toEqual(["package/dist/index.js"]);
  });

  it("collects export entries from nested export maps", () => {
    const entries = getExportEntries({
      import: "./dist/index.js",
      require: "./dist/index.cjs",
      types: {
        import: "./dist/index.d.ts",
        require: "./dist/index.d.cts"
      }
    });

    expect(entries.sort()).toEqual(
      [
        "package/dist/index.cjs",
        "package/dist/index.d.cts",
        "package/dist/index.d.ts",
        "package/dist/index.js"
      ].sort()
    );
  });

  it("throws when required entries are missing", () => {
    expect(() => assertIncludes(["a", "b"], ["a", "c"], "test")).toThrow(
      "[pack-smoke] Missing test entries: c"
    );
  });

  it("passes when all required entries exist", () => {
    expect(() => assertIncludes(["a", "b"], ["a"], "test")).not.toThrow();
  });
});
