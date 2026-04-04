---
id: snapshot
title: Snapshot
sidebar_label: Snapshot
---

The snapshot is the single read model for a live journey machine.

If you only inspect one value to understand what is true right now, inspect the snapshot.

## Mental Model

```text
snapshot
├─ currentStepId        -> where the machine is now
├─ history              -> realized path + current pointer
├─ context              -> shared runtime data
├─ visited              -> whether each step was ever entered
├─ status               -> idled / running / completed / terminated
└─ async                -> loading phases and last async error by step
```

## Snapshot Shape

```ts
type JourneySnapshot<TContext, TStepId extends string> = {
  currentStepId: TStepId;
  history: {
    timeline: readonly TStepId[];
    index: number;
  };
  context: TContext;
  visited: Record<TStepId, boolean>;
  status: "idled" | "running" | "completed" | "terminated";
  async: JourneyAsyncState<TStepId>;
};
```

## Field Guide

| Field              | Answers                                                            | Related docs                       |
| ------------------ | ------------------------------------------------------------------ | ---------------------------------- |
| `currentStepId`    | Which step is active right now?                                    | [History](/docs/core/history)      |
| `history.timeline` | Which realized path did the user actually take?                    | [History](/docs/core/history)      |
| `history.index`    | Which timeline entry is considered "now"?                          | [History](/docs/core/history)      |
| `context`          | What shared data do guards, transition updates, and UI read from?  | [Async Behavior](/docs/core/async) |
| `visited`          | Which steps have ever been entered at least once?                  | [History](/docs/core/history)      |
| `status`           | Is the machine idled, active, complete, or terminated?             | [Lifecycle](/docs/core/lifecycle)  |
| `async`            | Is async work in flight, and which step owns the last async error? | [Async Behavior](/docs/core/async) |

Treat the snapshot as a read model. Rendering, debugging, persistence, and selector subscriptions should all be able
to explain themselves from this one object.

The value returned from `getSnapshot()` is immutable runtime output. Read it, derive from it, and discard it. Do not
try to mutate it in place.

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

These stay true while a machine exists:

- `history.timeline.length >= 1`
- `0 <= history.index < history.timeline.length`
- `currentStepId === history.timeline[history.index]`

Those invariants are what make history navigation, snapshot selectors, and persistence safer to reason about.

## How Snapshot Writes Happen

Different runtime actions update the snapshot for different reasons:

| Reason       | Typical source                                                                                   | See implementation                                                                                      |
| ------------ | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| `transition` | step-to-step sends, terminal sends, headless `goToStepById`, declared `goToStepById` transitions | [Send Pipeline](/docs/core/architecture/send), [Navigation Commits](/docs/core/architecture/navigation) |
| `navigation` | `goToPreviousStep(...)`, `goToLastVisitedStep()`                                                 | [Navigation Commits](/docs/core/architecture/navigation)                                                |
| `async`      | guard loading, idle, or error updates                                                            | [Async State](/docs/core/architecture/async-state)                                                      |
| `context`    | `updateContext(...)`                                                                             | [Controls](/docs/core/architecture/controls)                                                            |
| `start`      | `startJourney()`                                                                                 | [Controls](/docs/core/architecture/controls)                                                            |
| `reset`      | `resetJourney()`                                                                                 | [Controls](/docs/core/architecture/controls)                                                            |

This is mainly visible to plugins and advanced instrumentation, but it is also a useful debugging frame: not every
snapshot write means "a transition happened".

## Practical Notes

- `history.timeline` is realized history, not authored step order.
- A fresh machine snapshot is `idled` until `startJourney()` is called.
- Pointer moves such as `goToPreviousStep(...)` and `goToLastVisitedStep()` do not rewrite `visited`.
- `context` and `async` are immutable read branches in the returned snapshot. Change runtime state through
  `updateContext(...)`, transition updates, or reset/start APIs instead of mutating the
  snapshot object.
- `async.isLoading` is machine-wide, while `async.byStep[stepId]` gives you the step-level detail for UI.
- Step definition metadata lives outside the snapshot. Read it through `machine.getStepMeta(stepId)` when needed.

## Useful Reads

```ts
const snapshot = machine.getSnapshot();

const currentStep = snapshot.currentStepId;
const currentAsync = snapshot.async.byStep[currentStep];
const atHistoryTail = snapshot.history.index === snapshot.history.timeline.length - 1;
const canRenderNormally = snapshot.status === "running" && currentAsync.phase === "idle";
```

## Recommended Reading

- Read [Runtime Reference Overview](/docs/core/runtime-reference) for the section map.
- Read [Lifecycle](/docs/core/lifecycle) for the events that explain how this snapshot changed.
- Read [Async Behavior](/docs/core/async) for the `async` branch of the snapshot.
- Read [Timeline Navigation](/docs/core/history) for `history`, `visited`, and pointer behavior.
- Read [Runtime Queue](/docs/core/architecture/runtime) and [Navigation Commits](/docs/core/architecture/navigation)
  if you want the implementation side.
