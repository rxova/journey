---
title: Timeline Navigation
sidebar_position: 7
---

Journey navigation is built on a timeline + pointer model.

This is the reason back/forward behavior is deterministic instead of guesswork.

## The Model

- `history.timeline`: the path of reached steps.
- `history.index`: the current pointer into that path.
- `currentStepId`: always `history.timeline[history.index]`.

## Why This Matters

You get two benefits at once:

- true history (what happened)
- current position (where you are now)

That makes debugging and replay much easier.

## Built-in Navigation APIs

- `goToPreviousStep(steps?)`: move pointer backward.
- `goToLastVisitedStep()`: move pointer to timeline tail.

You can also send `back` as an event:

```ts
await machine.send({ type: "back" });
```

If no explicit `back` transition matches, Journey falls back to `goToPreviousStep(1)`.

## Branching After Going Back

When you are not at the tail and a forward transition happens, Journey:

1. truncates timeline to `history.index + 1`
2. appends the new target step
3. moves pointer to the new end

Example:

- before: `timeline = ["start", "details", "payment", "review"]`, `index = 1`
- forward to `upsell`
- after: `timeline = ["start", "details", "upsell"]`, `index = 2`

This is the same mental model users expect from history systems.

## `visited` vs Pointer

`visited` tracks whether a step was ever entered.

Pointer navigation does not rewrite `visited`, because revisiting old timeline positions should not erase historical facts.
