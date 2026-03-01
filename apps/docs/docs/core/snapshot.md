---
id: snapshot
title: Snapshot
sidebar_label: Snapshot
---

The snapshot is the single source of truth for your journey at any moment.

If you only look at one thing to understand what is happening right now, look at the snapshot.

## Snapshot Shape

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

## What Each Field Means

- `currentStepId`: the exact step currently active right now. This is the value your UI usually renders from.
- `history.timeline`: an ordered array of step ids that records the real path the user has taken so far.
- `history.index`: the current pointer position inside `history.timeline`; it tells you which timeline entry is "now".
- `context`: shared journey data (form values, flags, ids, etc.) used by guards, effects, and components.
- `visited`: an object map keyed by step id (`{ [stepId]: boolean }`) that tells you if a step was ever entered at least once.
- `stepMeta`: per-step runtime metadata map for extra UI or business info that belongs to a specific step.
- `status`: lifecycle state of the machine: `running` (active), `complete` (finished), or `terminated` (closed early).
- `async`: async state per step, including loading phase and last error, so UI can show spinners/retries/errors consistently.

## Example Snapshot

```ts
const snapshot = machine.getSnapshot();

const exampleSnapshot = {
  currentStepId: "payment",
  history: {
    timeline: ["start", "details", "payment"],
    index: 2
  },
  context: {
    isVip: false
  },
  visited: {
    start: true,
    details: true,
    payment: true,
    review: false
  },
  stepMeta: {
    start: {},
    details: {},
    payment: {},
    review: {}
  },
  status: "running",
  async: {
    isLoading: false,
    byStep: {
      start: { phase: "idle", eventType: null, transitionId: null, error: null },
      details: { phase: "idle", eventType: null, transitionId: null, error: null },
      payment: { phase: "idle", eventType: null, transitionId: null, error: null },
      review: { phase: "idle", eventType: null, transitionId: null, error: null }
    }
  }
};
```

## Invariants You Can Trust

These are always true while a machine exists:

- `history.timeline.length >= 1`
- `0 <= history.index < history.timeline.length`
- `currentStepId === history.timeline[history.index]`

These invariants are why Journey behavior is predictable and testable.

## Practical Notes

`history.timeline` represents where the user really went, not where you expected them to go.

Pointer moves (`goToPreviousStep`, `goToLastVisitedStep`) do not rewrite `visited`.

`stepMeta` is runtime metadata and should be updated through `updateStepMetadata`.
