---
title: "Timeline Navigation"
---

Journey navigation is built on a timeline + pointer model.

This is the reason back/forward behavior is deterministic instead of guesswork.

## Mental Model

```text
timeline: [start] -> [details] -> [payment] -> [review]
index:                           ^
currentStepId:                   "payment"
```

The timeline records realized history. The index chooses which point in that realized history is considered "now".

## The Model

- `history.timeline`: the path of reached steps.
- `history.index`: the current pointer into that path.
- `currentStepId`: always `history.timeline[history.index]`.

## Why This Matters

You get two benefits at once:

- true history (what happened)
- current position (where you are now)

That makes debugging and replay much easier.

## Navigation Modes

| Operation                       | What changes                                      | What does not change                            |
| ------------------------------- | ------------------------------------------------- | ----------------------------------------------- |
| step transition                 | appends or rewrites realized tail                 | earlier realized history before current pointer |
| `goToPreviousStep(steps?)`      | moves pointer backward                            | timeline entries, `visited`                     |
| `goToLastVisitedStep()`         | moves pointer to the realized tail                | timeline entries, `visited`                     |
| headless `goToStepById(stepId)` | appends target as a new realized step when needed | earlier realized history before current pointer |

## Built-in Navigation APIs

- `goToPreviousStep(steps?)`: move pointer backward
- `goToLastVisitedStep()`: move pointer to timeline tail
- `goToStepById(stepId)`: direct jump in headless mode, or a declared transition in graph/linear mode

You can also model a custom `back` event:

```ts
await machine.send({ type: "back" });
```

Journey does not treat `back` as a built-in event. If you want `back` behavior, declare it as a custom event and
add explicit `back` transitions.

Direct helper and send fallback are related but not identical:

- `machine.goToPreviousStep()` is pure pointer navigation
- `machine.send({ type: "goToPreviousStep" })` goes through the send pipeline first
- `machine.send({ type: "back" })` is just a custom event, so it only does something when your journey declares a
  matching `back` transition

## Branching After Going Back

When you are not at the tail and a forward transition happens, Journey:

1. truncates timeline to `history.index + 1`
2. appends the new target step
3. moves pointer to the new end

Example:

- before: `timeline = ["start", "details", "payment", "review"]`, `index = 1`
- forward to `upsell`
- after: `timeline = ["start", "details", "upsell"]`, `index = 2`

```text
before
[start] -> [details] -> [payment] -> [review]
              ^

after forward transition to "upsell"
[start] -> [details] -> [upsell]
                           ^
```

This is the same mental model users expect from history systems.

## `visited` vs Pointer

`visited` tracks whether a step was ever entered.

Pointer navigation does not rewrite `visited`, because revisiting old timeline positions should not erase historical facts.

That distinction is useful in UI:

- use `history.index` and `currentStepId` for current position
- use `visited[stepId]` for "has this step ever happened?"

## No-Op Cases

- `goToPreviousStep(...)` is a no-op at the start of history
- `goToLastVisitedStep()` is a no-op when you are already at the realized tail
- pointer helpers are no-ops when machine status is terminal
- explicit `goToPreviousStep` transitions still win over built-in previous-step navigation fallback

## Recommended Reading

- Read [Snapshot](./snapshot.md) for the full shape of `history` and `visited`.
- Read [Lifecycle](./lifecycle.md) for `navigation.previous` and `navigation.lastVisited`.
- Read [Navigation Commits](./architecture/navigation.md) for the implementation side.
- Read [Send Pipeline](./architecture/send.md) if you want to understand fallback navigation from `send(...)`.
