---
title: "Getting Started"
description: "Answer questions about a state with rules and a sampled panel of models."
---

`@rxova/journey-judge` answers a set of questions about a state. Rules settle what they can without
a call; a panel of models answers the rest by sampling, and the samples are combined into one answer
per question with a confidence. Each judgement is one run of a Journey graph.

## Install

```bash
npm install @rxova/journey-core @rxova/journey-judge
```

`@rxova/journey-core` is a peer dependency. The judge has no provider SDK: each model on the panel
brings its own `complete` function.

## Bring a model

```ts
import type { CompletionRequest, JudgeModel } from "@rxova/journey-judge";

const modelA: JudgeModel = {
  id: "model-a",
  complete: ({ system, prompt, schema, temperature, signal }: CompletionRequest) =>
    callYourProvider({ system, prompt, schema, temperature, signal })
};
```

`schema` is the JSON Schema of the reply, for a provider's structured-output or tool mode. Pass
`signal` on: it aborts on the call's timeout and when the judgement stops. Resolve with the raw reply
text; the judge parses and validates it.

## Ask

```ts
import { createJudge } from "@rxova/journey-judge";

const judge = createJudge({ panel: [modelA, modelB] });

const { answers, calls, trail } = await judge.ask({
  state: { plans },
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
      ask: "How detailed is the stronger plan?",
      levels: ["thin", "enough", "thorough"],
      fallback: 1
    }
  }
});
```

| Kind     | You declare                   | The answer holds                                |
| -------- | ----------------------------- | ----------------------------------------------- |
| `choice` | `options`, key to description | `choice`: an option key or `"tie"`, and `votes` |
| `score`  | `levels`, lowest first        | `score`: the median level index                 |
| `binary` | what `yes` and `no` mean      | `probability` of yes, from 0 to 1               |

Every answer also has `confidence` (0 to 1), `abstained`, and `source`: `rule`, `panel`,
`abstained` or `skipped`. `fallback` is the answer a question takes when it is skipped or the panel
falls short.

## Rules and skip

```ts
await judge.ask({
  state,
  questions,
  rules: {
    stronger: [
      {
        id: "only-one",
        decide: (state) => (state.plans.length === 1 ? { choice: "first" } : undefined)
      }
    ]
  },
  skip: ["detail"]
});
```

Rules run in order before any call; the first to return a decision settles the question with
confidence 1 unless it says otherwise. Return `undefined` to pass. Give `decide` its `state`
parameter even when it ignores it: a parameterless arrow is typed before the questions are, and
loses its literal option key. `skip` names questions whose answer cannot matter now: they take their
fallback without a call.

## Options

| Option           | Default                                    | Meaning                                                    |
| ---------------- | ------------------------------------------ | ---------------------------------------------------------- |
| `samples`        | smallest multiple of the widest choice ≥ 3 | Samples per round                                          |
| `temperature`    | 0.7                                        | Passed to each call                                        |
| `repairAttempts` | 1                                          | Rounds of repair prompts for invalid replies               |
| `quorum`         | half the samples, rounded up               | Valid samples a question needs                             |
| `maxCalls`       | 4 × samples                                | Calls one judgement may make, retries and repairs included |
| `concurrency`    | 4                                          | Calls in flight at once                                    |
| `timeoutMs`      | none                                       | Budget for one call; a call past it is retried once        |
| `maxStateChars`  | 60 000                                     | Longest serialized state put in a prompt                   |

## Errors

`ask` rejects with a `JudgeError` whose `code` is `invalid` for options or input it cannot judge,
`unreachable` when every call of a sample round failed, or `aborted` when `signal` aborts. An error
a rule throws is rethrown as it is. `isJudgeError` narrows an unknown error.

## What the models see

The state is serialized as JSON into every prompt, inside a `<material>` fence, and the system prompt
marks it as untrusted. That lowers but does not remove the chance that text inside it sways a model.
Judge only what you would send to every model on the panel, and treat the answers as evidence rather
than authority.

Next: [how it works](../how-it-works/).
