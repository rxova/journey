---
title: FAQ
sidebar_position: 4
---

## How does Journey work under the hood?

Journey runs events through an internal async queue, so state updates happen one at a time in a predictable order. For each event, it emits `transition.start`, scans transitions in order (first valid match wins), evaluates guards (including async guards), and runs any transition effect before committing the next snapshot. After commit, it emits lifecycle events like `transition.success`, `step.exit`, and `step.enter`; if no transition matches, it returns a non-transition result (with a `back` fallback to previous-step navigation). This queue + deterministic matching model is what keeps behavior stable under real UI concurrency.

## How does navigation work?

Journey uses a timeline + pointer model.

`history.timeline` stores the path the user actually took.
`history.index` marks where the user is in that path.
`currentStepId` always matches `history.timeline[history.index]`.

This model makes navigation predictable and easy to debug.

## How does `back` work?

`back` is an event: `machine.send({ type: "back" })`.

Journey first checks whether you defined an explicit `back` transition.
If not, it falls back to `goToPreviousStep(1)`.

So you get custom behavior when needed and safe defaults when you do not.

## What is `goToLastVisitedStep()`?

It moves the pointer to the latest point in the current timeline.

This is useful when a user goes back to inspect something and then wants to return to where they were.

## What happens if I move forward while not at the end of history?

Journey truncates the old future path and appends the new one.

In other words, it behaves like normal history systems: once you branch from the past, that becomes the new future.

## How do I observe runtime behavior?

Use `subscribe(listener)` for snapshot reactivity.

Use `subscribeEvent(listener)` for typed lifecycle events.

Teams usually use both: `subscribe` for UI updates, `subscribeEvent` for logs, analytics, and debugging.

## Is Journey overkill for simple wizards?

For a tiny linear flow, plain local state may be enough.

Journey becomes valuable when flows start branching, needing guards/effects, or requiring reliable history, persistance, and observability.

Many teams start simple and adopt Journey when the first "this flow is getting messy" moment appears.

## Do I need React to use Journey?

No. `@rxova/journey-core` is framework-agnostic.

If you use React, `@rxova/journey-react` adds typed bindings that feel natural in React apps.

## Can users resume an unfinished journey later?

Yes. Persistence is optional and versioned.

You can store snapshots, migrate old versions, and recover safely. If stored data is invalid, Journey falls back to a valid initial state.

## How does Journey help with debugging production issues?

You get a deterministic transition model, explicit lifecycle events, and a reproducible history pointer.

That means issues are easier to replay, explain, and fix than with scattered component-level navigation logic.

## Is there a Chrome DevTools extension?

Yes. We are actively working on a Journey Chrome DevTools experience, and the extension is currently awaiting Chrome Web Store approval.
