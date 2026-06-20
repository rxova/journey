---
title: FAQ
sidebar_label: FAQ
---

import DocAccordion, { DocAccordionItem } from "@site/src/components/DocAccordion";

# FAQ

Short answers to the questions that come up most. For the concepts behind them, see
[Core concepts](/docs/core/concepts); for how the runtime works, see
[How it works](/docs/core/architecture).

## How it works

<DocAccordion>

<DocAccordionItem title="How does Journey work under the hood?">

Journey runs events through an internal async queue, so updates happen one at a time in a predictable
order. For each event it emits `transition.start`, scans transitions in order (first valid match
wins), evaluates guards (async included), derives the next context synchronously through
`updateContext` when a transition matches, then commits the next snapshot. After the commit it emits
lifecycle events like `transition.success`, `step.exit`, and `step.enter`; if nothing matches, it
returns a non-transition result. One special case: `send({ type: "goToPreviousStep" })` falls back to
pointer navigation when no explicit transition matches. That queue-plus-deterministic-matching model
is what keeps behavior stable under concurrent UI updates.

</DocAccordionItem>

<DocAccordionItem title="How does navigation work?">

Journey uses a timeline + pointer model. `history.timeline` stores the path the user took,
`history.index` marks where they are in it, and `currentStepId` always equals
`history.timeline[history.index]`. That makes navigation predictable and easy to debug — see
[Timeline & history](/docs/core/history).

</DocAccordionItem>

<DocAccordionItem title="How does back work?">

`back` is whatever you make it. Journey doesn't treat `back` as a built-in event — so
`machine.send({ type: "back" })` only does something if you've declared `back` transitions. For
built-in pointer navigation, use `goToPreviousStep()` or `send({ type: "goToPreviousStep" })`. You
get custom behavior when you want it and a safe default when you don't.

</DocAccordionItem>

<DocAccordionItem title="What is goToLastVisitedStep()?">

It moves the pointer to the most recent point in the current timeline — handy when a user steps back
to inspect something and then wants to return to where they were.

</DocAccordionItem>

<DocAccordionItem title="What if I move forward while not at the end of history?">

Journey truncates the old future and appends the new one, like any history system: once you branch
from the past, that branch becomes the new future. [Timeline & history](/docs/core/history#branching-after-going-back)
has the worked example.

</DocAccordionItem>

<DocAccordionItem title="How do I observe runtime behavior?">

Three subscriptions, for three needs: `subscribe(listener)` for snapshot reactivity,
`subscribeSelector(selector, listener, equalityFn?)` for a focused slice, and
`subscribeEvent(listener)` for the typed lifecycle stream. Teams usually use all three — `subscribe`
for UI, `subscribeSelector` for targeted updates, `subscribeEvent` for logs and analytics.

</DocAccordionItem>

</DocAccordion>

## Choosing Journey

<DocAccordion>

<DocAccordionItem title="When should I use a simple wizard library, and when should I use Journey?">

A simple wizard library is the right call when your flow is genuinely linear, every step is known
ahead of time, there's no branching, and there's no async work between steps. Three or four static
screens with next/back? A minimal stepper hook — or plain component state — will serve you well.
There's no reason to adopt a heavier tool for a problem that stays simple.

Journey is for the moment that stops being true. The signals:

- **Conditional branching** — "if the user picked X, skip step 3." In a wizard that becomes `if/else`
  scattered across `onClick` handlers calling `goToStep(index)`, invisible to tests and fragile when
  order changes. Journey declares branches as guarded transitions the runtime resolves
  deterministically.
- **Async transitions** — step 2 needs an API call before step 3. A wizard leaves you managing
  loading and error state by hand in every component. Journey models async guards as a first-class
  phase tracked per step in the snapshot.
- **History semantics** — index-based wizards track a number, so "back" after a skip lands on a step
  the user never visited. Journey records the realized path and walks the actual history.
- **Persistence** — wizards don't save progress; you hand-roll localStorage and hope indices didn't
  shift between deploys. Journey has a persistence plugin with hydration, migration, and filtering.
- **Observability** — a wizard gives you a step index. Journey emits typed lifecycle events and ships
  a Chrome DevTools extension.
- **Type safety** — wizards expose an untyped `goToStep(index)`. Journey uses string-literal step ids
  and type-checks the whole definition.
- **React 18 / SSR** — many wizard libraries predate `useSyncExternalStore` and can tear under
  concurrent rendering. Journey's React bindings are built on it, with SSR/RSC support.

**When you should _not_ move to Journey:** your flow will stay a static linear sequence; current step
index is all you need; you aren't using React 18 concurrency/Suspense/SSR; or the overhead of
defining transitions isn't worth it for a three-step form. Journey is built for flows that grow — if
yours won't, a simpler tool is the better choice.

</DocAccordionItem>

<DocAccordionItem title="Do I need React to use Journey?">

No. `@rxova/journey-core` is framework-agnostic. If you do use React, `@rxova/journey-react` adds
typed bindings that feel natural in a React app.

</DocAccordionItem>

<DocAccordionItem title="How does Journey compare to XState?">

They solve overlapping but different problems, and it's not a competition. XState is a general-purpose
finite state machine and statechart library. Journey is a domain-specific runtime for step-based
product flows.

**Reach for XState when you need** arbitrary state logic (traffic lights, connection states, game
logic), hierarchical or nested machines, parallel regions, or a visual editor and formal statechart
semantics.

**Reach for Journey when you need** wizards, onboarding, checkout, or KYC; realized history (not just
"current state" but "how did they get here"); first-class async phases observable in the UI; a linear
array _or_ a graph object for the same runtime; a small bundle with optional plugins; a React-first
integration; deterministic first-match-wins matching; and a snapshot-first model where one
serializable object holds everything.

**What Journey intentionally doesn't do:** hierarchical/nested machines, parallel regions, dynamic
step creation, the actor model (invoke/spawn), or a visual editor.

</DocAccordionItem>

</DocAccordion>

## In production

<DocAccordion>

<DocAccordionItem title="Can users resume an unfinished journey later?">

Yes — persistence is optional and versioned. Store snapshots, migrate old versions, and recover
safely; if stored data is invalid, hydration falls back to a valid initial state. See
[Persistence](/docs/core/persistence).

</DocAccordionItem>

<DocAccordionItem title="How does Journey help with debugging production issues?">

You get a deterministic transition model, explicit lifecycle events, and a reproducible history
pointer — so an issue is far easier to replay, explain, and fix than scattered component-level
navigation logic.

</DocAccordionItem>

<DocAccordionItem title="Is there a Chrome DevTools extension?">

Yes — install it from the
[Chrome Web Store](https://chromewebstore.google.com/detail/rxova-journey-devtools/bkmdccobpcagbmknjmmhbabcfphinjcm).

</DocAccordionItem>

</DocAccordion>
