# @rxova/journey-judge

Answer questions about a state with rules first and a sampled panel of models for the rest. Each
judgement is one run of a Journey graph, so the path it took is its trail.

## Install

```bash
npm install @rxova/journey-core @rxova/journey-judge
```

## Usage

```ts
import { createJudge } from "@rxova/journey-judge";

// `callModel(id, request)` is yours: send `system`, `prompt`, `schema`, `temperature` and `signal`
// to your provider and resolve with the reply text. The judge has no SDK and makes no call itself.
const judge = createJudge({
  panel: [
    { id: "model-a", complete: (request) => callModel("model-a", request) },
    { id: "model-b", weight: 2, complete: (request) => callModel("model-b", request) }
  ]
});

const { answers, trail } = await judge.ask({
  state: { plans: ["plan one", "plan two"] },
  questions: {
    stronger: {
      kind: "choice",
      ask: "Which plan is stronger?",
      options: { first: "the first plan", second: "the second plan" },
      fallback: "tie"
    },
    risky: {
      kind: "binary",
      ask: "Is either plan risky?",
      yes: "risky",
      no: "safe",
      fallback: 0.5
    },
    detail: {
      kind: "score",
      ask: "How detailed?",
      levels: ["thin", "enough", "thorough"],
      fallback: 1
    }
  },
  rules: {
    stronger: [
      {
        id: "only-one",
        decide: (state) => (state.plans.length === 1 ? { choice: "first" } : undefined)
      }
    ]
  }
});

answers.stronger.choice; // "first" | "second" | "tie"
answers.risky.probability; // 0 to 1
answers.detail.score; // a level index
trail.path; // ["rules", "sample", "aggregate", "done"]
```

Every answer carries a `confidence` from 0 to 1, whether it `abstained`, and its `source`: `rule`,
`panel`, `abstained` or `skipped`.

- **Rules** run first, in order; the first to return a decision settles the question without a call.
  Give a rule's `decide` its `state` parameter even when it ignores it: a parameterless arrow is
  typed before the questions are, and loses its literal option key.
- **Samples** go to the panel's models in turn. A choice question's options are rotated and relabelled
  (`option_A`, `option_B`, …) in each sample, so a model's bias toward a position or a label spreads
  over every option instead of favouring one.
- **Choice** answers are a weighted plurality, `"tie"` when no option holds more than half the weight
  or the top two are level. **Binary** answers are the weighted mean of five points from `no` to `yes`.
  **Score** answers are the median level.
- An invalid reply is shown back to its model with what was wrong (`repairAttempts`, default 1). A
  question short of `quorum` valid samples is sampled again while `maxCalls` allows (default
  4 × samples, retries and repairs included), then takes its `fallback`.
- A failed call is retried once. `ask` rejects with a `JudgeError`: `invalid` for input it cannot
  judge, `unreachable` when every call of a round failed, `aborted` when `signal` aborts.

The state is serialized as JSON into every prompt and sent to each model on the panel. The prompt marks
it as untrusted material, which lowers but does not remove the chance that text inside it sways a
model: judge what you would be willing to send, and treat the answers as evidence, not as authority.

`judge.definition` is the judge's graph, for `analyzeStructure` or the DevTools.

- [Judge docs](https://rxova.org/packages/journey/judge/getting-started/)
- [How it works](https://rxova.org/packages/journey/judge/how-it-works/)
