---
id: snapshot
title: Snapshot
sidebar_label: Snapshot
---

# Snapshot

The snapshot is the one object you render from, persist, and assert on. Whenever you need to answer
"what's true right now?", you read the snapshot — and nothing else. This page is the full field
guide to it.

If the term is new, [Core concepts](/docs/core/concepts#the-snapshot) introduces it; here we go
deep.

## The shape

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

Every field answers one question:

| Field              | Answers                                                            | Goes deeper in                     |
| ------------------ | ------------------------------------------------------------------ | ---------------------------------- |
| `currentStepId`    | Which step is active right now?                                    | [History](/docs/core/history)      |
| `history.timeline` | Which path did the user actually take?                             | [History](/docs/core/history)      |
| `history.index`    | Which timeline entry counts as "now"?                              | [History](/docs/core/history)      |
| `context`          | What shared data do guards, updates, and the UI read from?         | [Async behavior](/docs/core/async) |
| `visited`          | Which steps have ever been entered?                                | [History](/docs/core/history)      |
| `status`           | Is the machine idled, running, completed, or terminated?           | [Lifecycle](/docs/core/lifecycle)  |
| `async`            | Is async work in flight, and which step owns the last async error? | [Async behavior](/docs/core/async) |

The snapshot is immutable. Read it, derive from it, discard it — and change runtime state through
`updateContext(...)`, transition updates, or start/reset rather than mutating the object you got
back.

## Invariants you can rely on

These hold for as long as a machine exists:

- `history.timeline.length >= 1`
- `0 <= history.index < history.timeline.length`
- `currentStepId === history.timeline[history.index]`

Those three are what make history navigation, selectors, and persistence safe to reason about — the
"current step" is never out of sync with where the pointer says you are.

## An example snapshot

```ts
const snapshot = machine.getSnapshot();

// A checkout midway through, sitting on "payment":
const example = {
  currentStepId: "payment",
  history: {
    timeline: ["account", "details", "payment"],
    index: 2
  },
  context: { email: "ada@example.com", plan: "pro" },
  visited: { account: true, details: true, payment: true, review: false },
  status: "running",
  async: {
    isLoading: false,
    byStep: {
      account: { phase: "idle", eventType: null, transitionId: null, error: null },
      details: { phase: "idle", eventType: null, transitionId: null, error: null },
      payment: { phase: "idle", eventType: null, transitionId: null, error: null },
      review: { phase: "idle", eventType: null, transitionId: null, error: null }
    }
  }
};
```

## Reading it well

A few derived reads cover most UI needs:

```ts
const snapshot = machine.getSnapshot();

const currentStep = snapshot.currentStepId;
const currentAsync = snapshot.async.byStep[currentStep];
const atHistoryTail = snapshot.history.index === snapshot.history.timeline.length - 1;
const canRenderNormally = snapshot.status === "running" && currentAsync.phase === "idle";
```

Worth keeping in mind:

- `history.timeline` is the **realized** path, not your authored step order. A user who went back
  and branched has a timeline that differs from the step list.
- A fresh machine is `idled` until you call `startJourney()`.
- Pointer moves like `goToPreviousStep(...)` and `goToLastVisitedStep()` don't rewrite `visited` —
  revisiting an old position shouldn't erase the fact that a later step once happened.
- `async.isLoading` is machine-wide; `async.byStep[stepId]` gives you the per-step detail a spinner
  needs.
- Step metadata isn't in the snapshot — it's part of the definition. Read it with
  `machine.getStepMeta(stepId)`.

## Why a snapshot changes

Not every snapshot write means "a transition happened." Each write carries a **reason**, which is
mostly visible to plugins and instrumentation but also a useful debugging frame:

| Reason       | Triggered by                                                             | Up close                                                           |
| ------------ | ------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `transition` | step-to-step sends, terminal sends, headless and declared `goToStepById` | [Sending an event](/docs/core/architecture#sending-an-event)       |
| `navigation` | `goToPreviousStep(...)`, `goToLastVisitedStep()`                         | [Committing a move](/docs/core/architecture#committing-a-move)     |
| `async`      | guard loading, idle, or error updates                                    | [Async state](/docs/core/architecture#async-state)                 |
| `context`    | `updateContext(...)`                                                     | [Out-of-band changes](/docs/core/architecture#out-of-band-changes) |
| `start`      | `startJourney()`                                                         | [Lifecycle](/docs/core/lifecycle)                                  |
| `reset`      | `resetJourney()`                                                         | [Lifecycle](/docs/core/lifecycle)                                  |

## Where to next

- [Lifecycle & events](/docs/core/lifecycle) — the events that explain _how_ this snapshot changed.
- [Async behavior](/docs/core/async) — the `async` branch in detail.
- [Timeline & history](/docs/core/history) — `history`, `visited`, and pointer behavior.
