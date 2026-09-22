/**
 * Type-level assertions for the judge. Never executed — verified by
 * `pnpm typecheck` (matches no vitest include pattern).
 * Unused aliases are the assertion mechanism here.
 */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { createJudge } from "@rxova/journey-judge";
import type { Answer, JudgeModel, Question } from "@rxova/journey-judge";

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Expect<T extends true> = T;

declare const model: JudgeModel;
const judge = createJudge({ panel: [model] });

// ── Each answer is typed by its question's kind, and a choice by its option keys ──

export async function answerTypes() {
  const { answers } = await judge.ask({
    state: { plans: ["a", "b"] },
    questions: {
      stronger: {
        kind: "choice",
        ask: "Which plan is stronger?",
        options: { first: "the first plan", second: "the second plan" },
        fallback: "tie"
      },
      quality: { kind: "score", ask: "How good?", levels: ["bad", "good"], fallback: 0 },
      safe: { kind: "binary", ask: "Is it safe?", yes: "safe", no: "unsafe", fallback: 0.5 }
    }
  });
  type _Choice = Expect<Equal<typeof answers.stronger.choice, "first" | "second" | "tie">>;
  type _Votes = Expect<
    Equal<typeof answers.stronger.votes, Partial<Record<"first" | "second", number>>>
  >;
  type _Score = Expect<Equal<typeof answers.quality.score, number>>;
  type _Probability = Expect<Equal<typeof answers.safe.probability, number>>;
  type _Source = Expect<
    Equal<typeof answers.safe.source, "rule" | "panel" | "abstained" | "skipped">
  >;
  // @ts-expect-error a score answer has no choice
  void answers.quality.choice;
  // @ts-expect-error no such question
  void answers.missing;
}

// ── Rules and skip are checked against the questions and the state ──

export async function ruleTypes() {
  const questions = {
    pick: {
      kind: "choice",
      ask: "Which?",
      options: { left: "left", right: "right" },
      fallback: "tie"
    },
    ok: { kind: "binary", ask: "Ok?", yes: "yes", no: "no", fallback: 0.5 }
  } as const satisfies Record<string, Question>;

  await judge.ask({
    state: { side: "left" as "left" | "right" },
    questions,
    rules: {
      pick: [{ id: "side", decide: (state) => ({ choice: state.side }) }],
      ok: [{ id: "sure", decide: () => ({ probability: 1, confidence: 0.5 }) }]
    },
    skip: ["ok"]
  });

  await judge.ask({
    state: {},
    questions,
    // @ts-expect-error "up" is not an option of pick
    rules: { pick: [{ id: "bad", decide: () => ({ choice: "up" }) }] }
  });

  await judge.ask({
    state: {},
    questions,
    // @ts-expect-error a binary rule decides a probability, not a choice
    rules: { ok: [{ id: "bad", decide: () => ({ choice: "left" }) }] }
  });

  await judge.ask({
    state: {},
    questions,
    // @ts-expect-error skip names a question that does not exist
    skip: ["nope"]
  });
}

// ── A bare Answer defaults to any question kind ──

type _Bare = Expect<Equal<Answer["source"], "rule" | "panel" | "abstained" | "skipped">>;
