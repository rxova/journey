import { describe, expect, it } from "vitest";
import { toSerializable } from "@rxova/journey-core/replay";

/**
 * The previous walk deleted each node from its `seen` set on the way back up.
 * That is correct for cycles but re-traversed shared subtrees once per path
 * reaching them, so diamond-shaped sharing cost 2^N — on the hot path, because
 * the replay plugin serializes the whole snapshot on every transition by
 * default.
 */

/** Each level references the level below twice: distinct objects grow linearly, paths 2^N. */
function diamond(depth: number): unknown {
  let node: unknown = { leaf: true };
  for (let i = 0; i < depth; i++) node = { left: node, right: node, i };
  return node;
}

describe("toSerializable on shared subtrees", () => {
  it("stays fast where the old walk was exponential", () => {
    // Depth 26 did not finish in 120s before; depth 40 was 2^40 paths.
    const started = performance.now();
    toSerializable(diamond(40));
    const elapsed = performance.now() - started;

    expect(elapsed).toBeLessThan(100);
  });

  it("produces the same JSON as walking each path separately would", () => {
    const leaf = { value: 1 };
    const shared = { leaf };

    expect(toSerializable({ a: shared, b: shared })).toEqual({
      a: { leaf: { value: 1 } },
      b: { leaf: { value: 1 } }
    });
  });

  it("does not mistake a repeated sibling for a cycle", () => {
    const shared = { id: "s" };

    expect(toSerializable([shared, shared, shared])).toEqual([
      { id: "s" },
      { id: "s" },
      { id: "s" }
    ]);
  });
});

describe("toSerializable cycle handling", () => {
  it("marks an object cycle", () => {
    const node: Record<string, unknown> = { name: "a" };
    node.self = node;

    expect(toSerializable(node)).toEqual({ name: "a", self: "[circular]" });
  });

  it("marks an array cycle instead of overflowing the stack", () => {
    // Arrays were checked before the object branch and never entered `seen`,
    // so this recursed until the stack gave out.
    const items: unknown[] = [];
    items.push(items, "x");

    expect(toSerializable(items)).toEqual(["[circular]", "x"]);
  });

  it("marks a mutual cycle across two objects", () => {
    const a: Record<string, unknown> = { name: "a" };
    const b: Record<string, unknown> = { name: "b", a };
    a.b = b;

    expect(toSerializable(a)).toEqual({ name: "a", b: { name: "b", a: "[circular]" } });
  });
});

describe("toSerializable depth cap", () => {
  it("truncates a deep chain rather than throwing RangeError", () => {
    let chain: Record<string, unknown> = { end: true };
    for (let i = 0; i < 50_000; i++) chain = { next: chain };

    let output: unknown;
    expect(() => {
      output = toSerializable(chain);
    }).not.toThrow();

    let depth = 0;
    let cursor = output as Record<string, unknown> | string;
    while (typeof cursor === "object" && cursor.next !== undefined) {
      cursor = cursor.next as Record<string, unknown> | string;
      depth += 1;
    }
    expect(depth).toBe(100);
    expect(cursor).toBe("[max-depth]");
  });

  it("honours an explicit maxDepth", () => {
    const nested = { a: { b: { c: { d: "deep" } } } };

    expect(toSerializable(nested, { maxDepth: 2 })).toEqual({ a: { b: "[max-depth]" } });
  });

  it("leaves ordinary structures untouched", () => {
    const value = { list: [1, "two", null], when: new Date("2026-07-22T00:00:00.000Z") };

    expect(toSerializable(value)).toEqual({
      list: [1, "two", null],
      when: "2026-07-22T00:00:00.000Z"
    });
  });
});
