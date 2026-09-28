import { describe, expect, it } from "vitest";
import { eventWorkKey } from "@rxova/journey-core/testing";

describe("eventWorkKey", () => {
  it("is injective across step ids that could otherwise collide", () => {
    // Length-prefixing keeps "a" + "bGO" distinct from "ab" + "GO".
    expect(eventWorkKey("a", "bGO")).not.toBe(eventWorkKey("ab", "GO"));
  });

  it("is stable for the same pair", () => {
    expect(eventWorkKey("review", "SUBMIT")).toBe(eventWorkKey("review", "SUBMIT"));
  });
});
