---
title: FAQ
sidebar_position: 4
---

## How does navigation work?

Core uses a timeline-pointer model:

- `history.timeline`: ordered reached steps
- `history.index`: current pointer
- `currentStepId = history.timeline[history.index]`

## How does `back` work?

`back` is handled as an event you send (`machine.send({ type: "back" })`).

If no explicit transition matches `back`, core falls back to `goToPreviousStep(1)`.

## What is `goToLastVisitedStep()`?

It moves the pointer to the tail of the current timeline (`history.index = history.timeline.length - 1`).

## What happens if I navigate while not at timeline tail?

Forward transitions truncate future frames first, then append the new step.

## How do I observe runtime behavior?

Use:

- `subscribe(listener)` for snapshot change reactivity
- `subscribeEvent(listener)` for typed lifecycle telemetry
