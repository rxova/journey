---
id: snapshot
title: Snapshot
sidebar_label: Snapshot
---

## Shape

```ts
type JourneySnapshot<TContext, TStepId extends string, TStepMeta = unknown> = {
  currentStepId: TStepId;
  history: {
    timeline: readonly TStepId[];
    index: number;
  };
  context: TContext;
  visited: Record<TStepId, boolean>;
  stepMeta: Record<TStepId, TStepMeta>;
  status: "running" | "complete" | "terminated";
  async: JourneyAsyncState<TStepId>;
};
```

## Key Invariants

- `history.timeline.length >= 1` while machine exists.
- `0 <= history.index < history.timeline.length`.
- `currentStepId === history.timeline[history.index]`.
- `visited` is a step-id map (`Record<TStepId, boolean>`) independent from pointer moves.

## Notes

- `history.timeline` is the realized navigation path.
- Pointer moves (`goToPreviousStep`, `goToLastVisitedStep`) do not mutate `visited`.
- `stepMeta` is runtime metadata per step, updated with `updateStepMetadata`.
