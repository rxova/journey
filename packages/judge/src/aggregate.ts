/** A binary answer's five points, and the probability of yes each stands for. */
export const BINARY_SCALE = {
  no: 0,
  "lean-no": 0.25,
  unsure: 0.5,
  "lean-yes": 0.75,
  yes: 1
} as const;

/** One sample's value for a question, and how much its model's vote counts. */
export type Weighted<T> = { readonly value: T; readonly weight: number };

/**
 * Weighted plurality. The leader wins with its share of the weight as the
 * confidence, unless that share is below one half or the top two are level:
 * then the answer is `"tie"`.
 */
export function combineChoice(votes: readonly Weighted<string>[]): {
  choice: string;
  votes: Record<string, number>;
  confidence: number;
} {
  const tally: Record<string, number> = {};
  let total = 0;
  for (const { value, weight } of votes) {
    tally[value] = (tally[value] ?? 0) + weight;
    total += weight;
  }
  const [first, second] = Object.entries(tally).sort(([, a], [, b]) => b - a);
  // Callers never pass an empty list: a question below quorum is not combined.
  const [leader, top] = first ?? ["tie", 0];
  const share = total > 0 ? top / total : 0;
  const tie = share < 0.5 || second?.[1] === top;
  return { choice: tie ? "tie" : leader, votes: tally, confidence: share };
}

/**
 * The weighted mean probability of yes. Confidence falls with the spread: one
 * less twice the weighted standard deviation, which is 0.5 at most on [0, 1].
 */
export function combineBinary(values: readonly Weighted<number>[]): {
  probability: number;
  confidence: number;
} {
  let total = 0;
  let sum = 0;
  for (const { value, weight } of values) {
    total += weight;
    sum += value * weight;
  }
  const mean = total > 0 ? sum / total : 0.5;
  let variance = 0;
  for (const { value, weight } of values) variance += weight * (value - mean) ** 2;
  const spread = total > 0 ? Math.sqrt(variance / total) : 0.5;
  return { probability: mean, confidence: Math.max(0, 1 - 2 * spread) };
}

/** The value at quantile `q` of a sorted list, interpolating between neighbours. */
function quantile(sorted: readonly number[], q: number): number {
  const at = (sorted.length - 1) * q;
  const low = Math.floor(at);
  const lower = sorted[low] ?? 0;
  const upper = sorted[Math.ceil(at)] ?? lower;
  return lower + (upper - lower) * (at - low);
}

/**
 * The median level. Confidence is one less the interquartile range over the
 * width of the scale, so samples that agree give 1. Model weights do not
 * apply: a median of weighted samples would need a weight per level.
 */
export function combineScore(
  values: readonly number[],
  levels: number
): { score: number; confidence: number } {
  const sorted = [...values].sort((a, b) => a - b);
  const width = Math.max(1, levels - 1);
  const spread = quantile(sorted, 0.75) - quantile(sorted, 0.25);
  return { score: quantile(sorted, 0.5), confidence: Math.max(0, 1 - spread / width) };
}
