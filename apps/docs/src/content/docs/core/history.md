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

## History growth

The timeline is unbounded in 1.0: every navigation appends or retraces one entry, and nothing is
evicted while a run is live. Long-lived journeys therefore accumulate one entry per navigation.
`restart()` resets the timeline (with the rest of the run state). A `maxHistory` bound is planned
post-1.0 as a compatible addition; see the roadmap.

The cost shows up as **latency before it shows up as memory**. Each navigation copies the timeline
and re-derives the history slice, so per-navigation work grows linearly with timeline length and
total work grows quadratically. Measured on a two-step journey (ms per navigation, at a given
timeline length):

| Timeline length | ms per navigation |
| --------------- | ----------------- |
| 600             | 0.036             |
| 1,500           | 0.073             |
| 5,500           | 0.169             |
| 20,500          | 1.203             |

For ordinary journeys this is irrelevant — a wizard runs tens of navigations, not thousands. It
matters for sessions that never restart: kiosks, embedded flows, and long-lived single-page apps.
The threshold is high (~1.2 ms per navigation at 20,000, still imperceptible; you need roughly
100,000 to feel it), and `terminate()` + `restart()` returns cost to baseline immediately —
measured at 0.036 ms per navigation after a reset from 20,000 entries. Size against a restart
policy rather than against available memory.

## Hooks still apply

Timeline moves bypass graph transition gating. Optional next/previous work may stop before commit;
source `onLeave` runs only after commit and cannot block. The hook `event` is `null`.

## Where to next

- [Snapshot](./snapshot)
- [Linear](./usage/linear)
- [Graph](./usage/graph)
