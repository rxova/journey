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

## When should I use a simple wizard library, and when should I use Journey?

A simple wizard library is the right choice when your flow is truly linear, every step is known ahead of time, there is no conditional branching, and there is no async work between steps. If your wizard is three or four static screens with a "next" and "back" button and nothing else, a minimal stepper hook or even local component state will serve you well. There is no reason to adopt a heavier tool for a problem that stays simple.

Journey is designed for the moment that stops being true. In practice, these are the signals that a simple wizard is no longer enough:

**Conditional branching.** The product requires "if the user picked X, skip step 3 and go to step 5." In a simple wizard this ends up as `if/else` logic scattered across `onClick` handlers, calling `goToStep(someIndex)`. That logic is invisible to tests, impossible to visualize, and breaks the moment step order changes. Journey lets you declare branches as guarded transitions in the definition, and the runtime resolves them deterministically.

**Async transitions.** Step 2 needs an API call before the user can move to step 3. With a simple wizard, you manage loading and error state yourself with `useState` in every step component. Journey models async guard evaluation as a first-class phase, and the runtime tracks `evaluating-when` and `error` per step in the snapshot. Your UI reads `snapshot.async.byStep.login.phase` instead of maintaining parallel loading state.

**History and back-navigation semantics.** Index-based wizards track a step number. If the user went from step 0 to step 1 to step 3 (skipping step 2 via a condition), pressing "back" goes to index 2 — a step they never visited. You end up building skip-aware back logic yourself. Journey records the realized path the user actually took (`["login", "setup2fa", "verifyCode"]`) and pointer navigation walks that actual history.

**Persistence and resumption.** Simple wizards do not support saving progress. You serialize some state to localStorage, figure out which step to restore to, and hope the indices have not shifted between deploys. Journey offers a persistence plugin with snapshot hydration, version migration, and context filtering.

**Observability.** Simple wizards give you a step index and nothing else. When something goes wrong in production, there is no event log, no transition record, and no way to answer "how did the user end up here?" Journey emits typed lifecycle events (`transition.start`, `step.exit`, `step.enter`, `transition.error`) and provides a Chrome DevTools extension for timeline inspection.

**Type safety.** Simple wizards typically expose an untyped `goToStep(index)` API. Step references are numbers, not checked at compile time. Journey uses string step IDs as a literal union type, and the full definition — transitions, guards, context updates, events — is generic and type-checked. Invalid step references or event names are compile errors.

**React 18+ and SSR.** Most wizard libraries were written before React 18 and use `useState` and `useCallback` internally. They do not use `useSyncExternalStore`, which means they are not safe under concurrent features and can tear during concurrent renders. Journey's React bindings are built on `useSyncExternalStore` from the ground up, which guarantees consistent reads even under concurrent rendering, `startTransition`, and `Suspense`. The core machine is a framework-agnostic external store, and the React layer is a thin typed subscription — the same model React itself recommends for external state. Server rendering is supported through an owned client boundary: the core has zero React dependencies, the root `@rxova/journey-react` entry is server-safe, `@rxova/journey-react/client` provides an explicit client-marked subpath, snapshots are serializable, and `JourneyProvider` auto-starts on the client after hydration. Treat the React runtime as a client-boundary integration rather than a server-component-native package.

### When you should NOT move to Journey

- Your flow is and will remain a static linear sequence with no branching, no async, and no persistence needs.
- You do not need to answer "how did the user get here?" — current step index is enough.
- You are not using React 18+ features (concurrent rendering, Suspense, SSR) and do not plan to.
- The overhead of defining transitions, even in linear syntax, is not worth it for a three-step form.

Journey is designed for flows that grow. If yours will not, a simpler tool is the better choice.

## Do I need React to use Journey?

No. `@rxova/journey-core` is framework-agnostic.

If you use React, `@rxova/journey-react` adds typed bindings that feel natural in React apps.

## Can users resume an unfinished journey later?

Yes. Persistence is optional and versioned.

You can store snapshots, migrate old versions, and recover safely. If stored data is invalid, Journey falls back to a valid initial state.

## How does Journey help with debugging production issues?

You get a deterministic transition model, explicit lifecycle events, and a reproducible history pointer.

That means issues are easier to replay, explain, and fix than with scattered component-level navigation logic.

## How does Journey compare to XState?

Journey is not competing with XState — they solve overlapping but different problems. XState is a general-purpose finite state machine and statechart library. Journey is a domain-specific runtime for step-based product flows.

**Use XState when you need:**

- Arbitrary state transition logic (traffic lights, connection states, game logic)
- Hierarchical or nested state machines (parallel regions, child machines)
- Complex event-driven systems where the graph topology itself is the product
- A visual editor and formal statechart semantics

**Use Journey when you need:**

- Wizards, onboarding, checkout, KYC, claim filing — flows where users move through named steps
- Realized history — not just "current state" but "how did the user get here" with timeline and pointer navigation
- First-class async phases observable in the UI — `evaluating-when` and errors tracked per-step in the snapshot, not bolted on
- Two definition syntaxes: a linear array for simple sequences (`["start", "details", "review"]`) or a graph object for branching flows — XState only offers the graph
- A small bundle: core is **7.58 kB** brotlied, with optional plugins like [persistence](./persistence.md) and [getExecutionPaths](./plugins/execution-paths-plugin.md)
- A React-first integration with `useSyncExternalStore`, SSR/RSC support, and bound hooks — not a framework-agnostic adapter layer
- Deterministic ordered matching: first matching transition wins, no priority tables
- A snapshot-first model: one serializable object tells you current step, full timeline, context, visited map, async phase, and status

**What Journey intentionally does not do:**

- No hierarchical or nested machines
- No parallel/orthogonal regions
- No dynamic step creation at runtime
- No invoke/spawn (actors model)
- No visual editor or formal statechart semantics

## Is there a Chrome DevTools extension?

Yes. Install it from Chrome Web Store:

- https://chromewebstore.google.com/detail/rxova-journey-devtools/bkmdccobpcagbmknjmmhbabcfphinjcm
