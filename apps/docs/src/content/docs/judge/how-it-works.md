---
title: "How It Works"
description: "The judge's graph, how samples become answers, and what bounds the calls."
---

## The graph

A judgement is one run of this graph. Every step moves on its own with `always`, so `ask` starts the
machine and waits for `done`.

```text
rules ──open──▶ sample ──invalid──▶ repair ──▶ aggregate ──▶ done
  │               │                               │  │
  └──────▶ done   └──────────────▶ aggregate      │  └──short──▶ abstain ──▶ done
                                                  └──resample──▶ sample
```

- **rules**: skipped questions take their fallback; each other question's rules run in order. Any
  question still unanswered is open.
- **sample**: one round of samples for the open questions, spread over the panel in turn.
- **repair**: each reply from this round that failed validation is shown back to its model with
  what was wrong. A value the sample already had stands; the repaired reply only fills the gaps.
- **aggregate**: each open question with at least `quorum` valid samples is combined into an answer.
  The rest stay open: another round while `maxCalls` allows, `abstain` when it does not.
- **abstain**: what is still open takes its fallback, marked `abstained`.

The only cycle is `aggregate` back to `sample`, and every pass through it spends calls, so
`maxCalls` bounds the run. `judge.definition` is this graph, for `analyzeStructure` from
`@rxova/journey-core` or the DevTools.

## From samples to answers

A choice question's options are shown to a model under opaque labels, `option_A`, `option_B` and so
on, and each sample in a round rotates their order and relabels them. A model's lean toward the first
option, or toward a label, therefore lands on a different option in each sample and cancels out. The
default `samples` is a multiple of the widest choice so every option sits in every position equally
often.

| Kind     | Combined as                                                                     | Confidence                            |
| -------- | ------------------------------------------------------------------------------- | ------------------------------------- |
| `choice` | Weighted plurality; `"tie"` below half the weight or at a level top two         | The winner's share of the weight      |
| `binary` | Weighted mean of `no` 0, `lean-no` 0.25, `unsure` 0.5, `lean-yes` 0.75, `yes` 1 | 1 − 2 × the weighted spread           |
| `score`  | Median level, unweighted                                                        | 1 − interquartile range ÷ scale width |

A model's `weight` (default 1) counts in choice and binary answers.

## Calls

Each call counts against `maxCalls`, retries and repairs included. A failed call, or one past
`timeoutMs`, is retried once when the budget allows; every call is reserved before it runs, so a
retry never takes a call that another sample's first try still needs. A round in which every call
failed ends the judgement as `unreachable`. Aborting `signal` aborts the calls in flight.

## The trail

`trail.path` is the steps the machine took. `trail.answers` says, per question, which rule settled it
or which samples it was combined from. `trail.samples` holds every sample: its model, round,
rotation, raw reply, repairs, and the values and errors read from it.
