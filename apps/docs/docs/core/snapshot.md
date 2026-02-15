---
title: Snapshot Model
sidebar_position: 4
---

`machine.getSnapshot()` returns the full observable runtime state.

## Shape

```ts
type JourneySnapshot<TContext, TStepId extends string> = {
  current: TStepId;
  context: TContext;
  history: readonly TStepId[];
  visited: readonly TStepId[];
  status: "running" | "complete" | "closed";
  async: {
    isLoading: boolean;
    byStep: Record<
      TStepId,
      {
        phase: "idle" | "evaluating-when" | "running-effect" | "error";
        eventType: string | null;
        transitionId: string | null;
        error: unknown | null;
      }
    >;
  };
};
```

## Field Semantics

- `current`: active step.
- `context`: current business state.
- `history`: stack-like trail of previous steps.
- `visited`: unique ordered trail of all reached steps.
- `status`: running or terminal (`complete`/`closed`).

## Invariants

- `visited` always contains `current`.
- `history` can be trimmed independently of `visited`.
- `async.byStep` exists for every declared step.

## Subscription Pattern

```ts
const unsubscribe = machine.subscribe(() => {
  const snapshot = machine.getSnapshot();
  console.log(snapshot.current, snapshot.status);
});

unsubscribe();
```

## UI Derivations

Example derived booleans (with known step IDs in your app):

- `isReviewStep = snapshot.current === reviewStepId`
- `isTerminal = snapshot.status !== "running"`
- `stepLoading = snapshot.async.byStep[snapshot.current].phase !== "idle"`

Keep derivation in render logic or selectors instead of storing duplicated state.
