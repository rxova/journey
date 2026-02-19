---
title: Timeline Navigation
sidebar_position: 7
---

The runtime uses a canonical timeline-pointer model:

- `history.timeline`: linear sequence of reached steps.
- `history.index`: pointer to current position.
- `currentStepId = history.timeline[history.index]`.

## Built-in Navigation

- `goToPreviousStep(steps?)`
- `goToLastVisitedStep()`

`send({ type: "back" })` is still valid and first-class.

If no explicit transition matches `back`, the machine automatically falls back to `goToPreviousStep(1)`.

## Timeline Branching Rule

When you are not at the tail (`history.index < history.timeline.length - 1`) and a forward transition happens, the machine:

1. Truncates timeline to `history.index + 1`
2. Appends the new target step
3. Moves pointer to the new end

## `visited`

`visited` is a step-id map (`Record<TStepId, boolean>`) and is independent from pointer moves.
