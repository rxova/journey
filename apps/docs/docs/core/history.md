---
id: history
title: Timeline & history
---

# Timeline & history

Journey records a browser-like timeline for the current run.

```ts
snapshot.history.timeline;
snapshot.history.currentIndex;
snapshot.history.visited;
snapshot.history.canGoBack;
snapshot.history.canGoForward;
```

## Pointer movement

```ts
await machine.navigate.goToPreviousStep();
await machine.navigate.goToPreviousStep(3);
await machine.navigate.goToNextStep();
await machine.navigate.goToLastVisitedStep();
```

Back clamps to index `0` when `n` is larger than the available distance. It fails with
`"out-of-bounds"` only when already at the first entry. `goToLastVisitedStep()` fails with `"no-op"`
when already at the tip.

`goToNextStep()` first moves the pointer through an existing future entry. At the tip, a linear
journey falls back to the next declared step; a graph journey returns `"out-of-bounds"`.

## Appending and branching

Graph sends and `goToStepById` append destinations. Linear machines also expose
`goToStepByIndex(index)`, which targets a step by its declared-order index; an out-of-range or
non-integer index rejects with `"invalid-target"`. If the pointer is behind the timeline tip, the
old future is removed first:

```text
[account, shipping, review]
          ^ back to shipping

append payment

[account, shipping, payment]
                    ^
```

## Visited state

`history.visited[id]` means the step has been entered at least once during the current run. It is
independent of the current pointer and survives timeline branching. `steps.visitedStepCount` counts
those `true` entries.

`currentStep.isFirstTimeVisit` is true only during a step's first entry in the run.

## Hooks still apply

Timeline moves bypass graph transition gating. Optional next/previous work may stop before commit;
source `onLeave` runs only after commit and cannot block. The hook `event` is `null`.

## Where to next

- [Snapshot](./snapshot)
- [Linear](./usage/linear)
- [Graph](./usage/graph)
