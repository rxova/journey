import { describe, expect, it } from "vitest";
import { combineBinary, combineChoice, combineScore } from "@rxova/journey-judge/testing";

const votes = (...values: string[]) => values.map((value) => ({ value, weight: 1 }));

describe("combineChoice", () => {
  it("gives the leader its share of the weight as confidence", () => {
    expect(combineChoice(votes("a", "a", "b"))).toEqual({
      choice: "a",
      votes: { a: 2, b: 1 },
      confidence: 2 / 3
    });
  });

  it("calls a level top two a tie", () => {
    expect(combineChoice(votes("a", "b")).choice).toBe("tie");
  });

  it("calls a leader below half the weight a tie", () => {
    const result = combineChoice(votes("a", "a", "b", "c", "d"));
    expect(result).toMatchObject({ choice: "tie", confidence: 0.4 });
  });

  it("lets a heavier model outvote two lighter ones", () => {
    const result = combineChoice([
      { value: "a", weight: 3 },
      { value: "b", weight: 1 },
      { value: "b", weight: 1 }
    ]);
    expect(result).toMatchObject({ choice: "a", confidence: 0.6 });
  });

  it("falls back to a tie with no votes", () => {
    expect(combineChoice([])).toEqual({ choice: "tie", votes: {}, confidence: 0 });
  });

  it("gives a tie with zero confidence when every weight is zero", () => {
    expect(combineChoice([{ value: "a", weight: 0 }])).toMatchObject({
      choice: "tie",
      confidence: 0
    });
  });
});

describe("combineBinary", () => {
  it("is fully confident when the samples agree", () => {
    const w = (value: number) => ({ value, weight: 1 });
    expect(combineBinary([w(0.75), w(0.75)])).toEqual({ probability: 0.75, confidence: 1 });
  });

  it("loses all confidence when the samples split to the ends", () => {
    const w = (value: number) => ({ value, weight: 1 });
    expect(combineBinary([w(0), w(1)])).toEqual({ probability: 0.5, confidence: 0 });
  });

  it("takes the weighted mean", () => {
    const result = combineBinary([
      { value: 1, weight: 3 },
      { value: 0, weight: 1 }
    ]);
    expect(result.probability).toBe(0.75);
    expect(result.confidence).toBeCloseTo(1 - 2 * Math.sqrt(0.1875));
  });

  it("is unsure with no weight", () => {
    expect(combineBinary([])).toEqual({ probability: 0.5, confidence: 0 });
  });
});

describe("combineScore", () => {
  it("takes the median level", () => {
    expect(combineScore([4, 1, 3], 5)).toEqual({ score: 3, confidence: 1 - 1.5 / 4 });
  });

  it("interpolates the median of an even count", () => {
    expect(combineScore([1, 2], 5).score).toBe(1.5);
  });

  it("is fully confident when the samples agree", () => {
    expect(combineScore([2, 2, 2], 3)).toEqual({ score: 2, confidence: 1 });
  });

  it("never goes below zero confidence", () => {
    expect(combineScore([0, 0, 1, 1], 2).confidence).toBe(0);
  });

  it("gives level 0 with nothing to combine", () => {
    expect(combineScore([], 3)).toEqual({ score: 0, confidence: 1 });
  });
});
