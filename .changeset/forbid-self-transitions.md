---
"@rxova/journey-core": minor
---

Forbid self-transitions at creation: a transition, `after` delay, or `effect`
branch may no longer target the step it is declared on.

A self-transition (`to` equal to the current step) re-enters the step — it
re-runs `onEnter`/`onLeave`, cancels and re-arms the step's `after` timer, and
re-starts its `effect` — while suppressing the `step.enter`/`step.exit`
observation events, so observers and lifecycle callbacks disagreed about whether
a re-entry happened. This was almost always a mistake; the intent is usually a
context change that should _not_ navigate.

`resolveJourneyDefinition` now throws a descriptive error at machine creation for
a self-targeting graph edge, `after` delay, or `effect` `onResolved` /
`onRejected` branch. To change context without navigating, call
`api.updateContext(...)` instead.

This is runtime enforcement; a compile-time guard was prototyped but rejected
because narrowing each step's `to` to exclude itself regressed type inference for
consumers such as `getExecutionPaths` and broke dynamic `to: StepId` targets.
