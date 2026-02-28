import { describe, expect, it } from "vitest";

import { EMPTY_STRUCTURED_DIFF, computeStructuredDiff } from "../src/panel/diff";

describe("computeStructuredDiff", () => {
  it("returns empty diff for identical values", () => {
    expect(computeStructuredDiff({ a: 1 }, { a: 1 })).toEqual(EMPTY_STRUCTURED_DIFF);
  });

  it("records removed array indexes", () => {
    const result = computeStructuredDiff(
      {
        timeline: ["start", "details", "review"]
      },
      {
        timeline: ["start"]
      }
    );

    expect(result.removed["timeline[1]"]).toBe("details");
    expect(result.removed["timeline[2]"]).toBe("review");
  });

  it("records root-level changes for non-object values", () => {
    const result = computeStructuredDiff("old", "new");
    expect(result.changed.root).toEqual({ before: "old", after: "new" });
  });

  it("uses root array index paths when diff starts from arrays", () => {
    const result = computeStructuredDiff(["start"], ["start", "review"]);
    expect(result.added["[1]"]).toBe("review");
  });

  it("treats null-prototype objects as plain objects", () => {
    const previous = Object.create(null) as Record<string, unknown>;
    previous.value = 1;

    const next = Object.create(null) as Record<string, unknown>;
    next.value = 2;

    const result = computeStructuredDiff(previous, next);
    expect(result.changed.value).toEqual({ before: 1, after: 2 });
  });
});
