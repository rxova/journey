---
title: "FAQ"
---

## How does Journey work under the hood?

Journey runs events through an internal async queue, so state updates happen one at a time in a predictable order. For each event, it emits `transition.start`, scans transitions in order (first valid match wins), evaluates guards (including async guards), derives the next context synchronously through `updateContext` when a transition matches, and then commits the next snapshot. After commit, it emits lifecycle events like `transition.success`, `step.exit`, and `step.enter`; if no transition matches, it returns a non-transition result. A special case exists for `send({ type: "goToPreviousStep" })`, which can fall back to previous-step pointer navigation when no explicit transition matches. This queue + deterministic matching model is what keeps behavior stable under real UI concurrency.

## How does navigation work?

Journey uses a timeline + pointer model.

`history.timeline` stores the path the user actually took.
`history.index` marks where the user is in that path.
`currentStepId` always matches `history.timeline[history.index]`.

This model makes navigation predictable and easy to debug.

## How does `back` work?

`back` is an event: `machine.send({ type: "back" })`.

Journey does not treat `back` as a built-in event.

If you want `back` behavior, declare `back` as a custom event and add explicit `back` transitions. If you want
built-in previous-step pointer navigation, use `goToPreviousStep()` or `send({ type: "goToPreviousStep" })`.

So you get custom behavior when needed and safe defaults when you do not.

## What is `goToLastVisitedStep()`?

It moves the pointer to the latest point in the current timeline.

This is useful when a user goes back to inspect something and then wants to return to where they were.

## What happens if I move forward while not at the end of history?

Journey truncates the old future path and appends the new one.

In other words, it behaves like normal history systems: once you branch from the past, that becomes the new future.

## How do I observe runtime behavior?

Use `subscribe(listener)` for snapshot reactivity.

Use `subscribeSelector(selector, listener, equalityFn?)` when you only care about a selected snapshot slice.

Use `subscribeEvent(listener)` for typed lifecycle events.

Teams usually use all three: `subscribe` for UI updates, `subscribeSelector` for focused updates, and `subscribeEvent` for logs, analytics, and debugging.

## What is Journey for?

Journey models a multi-step flow as a declared graph: named steps, explicit transitions,
guards, and a shared typed context. The runtime owns navigation and exposes the result as one
snapshot. It covers the following.

**Conditional branching.** Branches are declared as guarded transitions in the definition, and
the runtime resolves them deterministically by ordered matching — first match wins.

**Async transitions.** Async guard evaluation is a first-class phase. The runtime tracks
`evaluating-when` and `error` per step in the snapshot, so a step reads
`snapshot.async.byStep.login.phase` instead of maintaining parallel loading state.

**History and back-navigation semantics.** Journey records the realized path the user took
(`["login", "setup2fa", "verifyCode"]`), and pointer navigation walks that path. Moving
forward after stepping back truncates the timeline at the new branch.

**Persistence and resumption.** The persistence plugin provides snapshot hydration, version
migration, and context filtering.

**Observability.** The runtime emits typed lifecycle events (`transition.start`, `step.exit`,
`step.enter`, `transition.error`), and a Chrome DevTools extension renders the timeline.

**Type safety.** Step IDs are a literal union type, and the full definition — transitions,
guards, context updates, events — is generic and type-checked. Invalid step references and
event names are compile errors.

**React 18+ and SSR.** The React bindings are built on `useSyncExternalStore`, which
guarantees consistent reads under concurrent rendering, `startTransition`, and `Suspense`. The
core machine is a framework-agnostic external store and the React layer is a thin typed
subscription. Server rendering is supported through an owned client boundary: the core has
zero React dependencies, the root `@rxova/journey-react` entry is server-safe,
`@rxova/journey-react/client` provides an explicit client-marked subpath, snapshots are
serializable, and `JourneyProvider` auto-starts on the client after hydration. Treat the React
runtime as a client-boundary integration rather than a server-component-native package.

## Do I need React to use Journey?

No. `@rxova/journey-core` is framework-agnostic.

If you use React, `@rxova/journey-react` adds typed bindings that feel natural in React apps.

## Can users resume an unfinished journey later?

Yes. Persistence is optional and versioned.

You can store snapshots, migrate old versions, and recover safely. If stored data is invalid, Journey falls back to a valid initial state.

## How does Journey help with debugging production issues?

You get a deterministic transition model, explicit lifecycle events, and a reproducible history pointer.

That means a transition sequence can be replayed, explained, and fixed from the event log.

## Is there a Chrome DevTools extension?

Yes. Install it from Chrome Web Store:

- https://chromewebstore.google.com/detail/rxova-journey-devtools/bkmdccobpcagbmknjmmhbabcfphinjcm
