---
id: snapshot
title: Snapshot
---

# Snapshot

`machine.getSnapshot()` returns the complete immutable read model for one point in time.

## Shared shape

```ts
const snapshot = machine.getSnapshot();

snapshot.type; // "linear" | "graph"
snapshot.status; // "idle" | "running" | "paused" | "completed" | "terminated"
snapshot.context;
snapshot.currentStep;
snapshot.transition;
snapshot.history;
snapshot.machine;
snapshot.plugins;
```

### Current step

`currentStep` is `null` before initial entry. Otherwise it contains:

| Field              | Meaning                                                   |
| ------------------ | --------------------------------------------------------- |
| `id`               | Current step id.                                          |
| `metadata`         | Static definition metadata.                               |
| `isFirstTimeVisit` | `true` only on the first entry of this step in the run.   |
| `async`            | Loading, success, and error state for current entry work. |

Linear current steps add `index`, `isFirstStep`, and `isLastStep`. Graph current steps add
`isTerminal`.

### Transition

```ts
snapshot.transition = {
  pending: false,
  phase: null, // "leaving" | "entering" | null
  from: null,
  to: null
};
```

### History

```ts
snapshot.history = {
  timeline: ["account", "review"],
  currentIndex: 1,
  visited: { account: true, review: true },
  canGoBack: true,
  canGoForward: false
};
```

`visited` has an entry for every declared step.

### Machine state

`snapshot.machine` provides `isLoading`, `isIdle`, `isRunning`, `isPaused`, `isCompleted`,
`isTerminated`, and `outcome`. `isLoading` mirrors `snapshot.transition.pending`.

```ts
snapshot.machine.outcome = null; // or { type: "completed" | "terminated", payload }
```

Completion and termination set `snapshot.machine.outcome`; only `restart()` clears it back to `null`.

## Linear snapshot

```ts
if (snapshot.type === "linear") {
  snapshot.steps.stepOrder;
  snapshot.steps.totalSteps;
  snapshot.steps.visitedStepCount;
  snapshot.currentStep?.isLastStep;
}
```

## Graph snapshot

```ts
if (snapshot.type === "graph") {
  snapshot.availableEvents;
  snapshot.availableSteps;
  snapshot.steps.totalSteps;
  snapshot.steps.visitedStepCount;
  snapshot.currentStep?.isTerminal;
}
```

Available events and targets include candidates whose `from` matches the current step and whose
guard currently passes. A terminal step has no declared outgoing transitions, regardless of guard
results.

## Update rules

Do not mutate a snapshot or its context. Use `machine.context.update()` and read the next snapshot.
Subscribe to slices when a consumer only needs one value:

```ts
machine.subscriptions.subscribeSelector(
  (next) => next.currentStep?.async,
  (asyncState) => renderAsyncState(asyncState)
);
```

## Where to next

- [Machine API](./api/machine-api)
- [Timeline and history](./history)
- [Async behavior](./async)
