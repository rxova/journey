---
"@rxova/journey-core": minor
"@rxova/journey-react": minor
---

Forbid self-transitions at creation: a transition, `after` delay, or `effect`
branch may no longer target the step it is declared on.

A self-transition (`to` equal to the current step) re-enters the step — it
re-runs `onEnter`/`onLeave`, cancels and re-arms the step's `after` timer, and
re-starts its `effect` — while suppressing the `step.enter`/`step.exit`
observation events, so observers and lifecycle callbacks disagreed about whether
a re-entry happened. This was almost always a mistake; the intent is usually a
context change that should _not_ navigate.

**Runtime**: `resolveJourneyDefinition` throws a descriptive error at machine
creation for a self-targeting graph edge, `after` delay, or `effect`
`onResolved` / `onRejected` branch. To change context without navigating, call
`api.updateContext(...)` instead.

**Compile-time**: the graph factories — core `createGraphJourney`, and React
`createJourney` / `createGraphJourney` / `createJourneyFactory` — now reject an
inline graph transition that targets its own step, surfacing `Self-transition
not allowed: step "X" cannot target its own step`. The check is an additive,
`NoInfer`-guarded constraint on the argument, so step-id inference for consumers
such as `getExecutionPaths` is unaffected and dynamic `to` targets keep working.
It fires for definitions written inline at the call; definitions passed as a
pre-typed variable are covered by the runtime guard.
