---
title: Core API
sidebar_label: API overview
slug: /api
---

# Core API

This is the reference hub for `@rxova/journey-core` — what you import, how you drive a machine, and
the types you'll reach for. If you're learning the concepts, start with
[Core concepts](/docs/core/concepts); this page assumes you know them and want the surface.

## What you import

```ts
import {
  createLinearJourney,
  createGraphJourney,
  createHeadlessJourney,
  createGraphJourneyBuilder,
  type JourneySnapshot,
  type JourneyObservationEvent
} from "@rxova/journey-core";
```

Three named factories, one per mode:

| Factory                 | Mode     | Transitions                                               |
| ----------------------- | -------- | --------------------------------------------------------- |
| `createLinearJourney`   | Linear   | Ordered steps array; `goToNextStep` advances the sequence |
| `createGraphJourney`    | Graph    | Object-keyed event map; guards and custom events          |
| `createHeadlessJourney` | Headless | None; the caller drives with `goToStepById`               |

:::note Deprecated
`createJourneyMachine` is still exported for backwards compatibility but is deprecated. Use the three
named factories.
:::

## Driving the machine

Start the machine first — it's created `idled`:

```ts
machine.startJourney();
```

Then drive it with explicit events or the convenience helpers. `send` gives you the result to
inspect:

```ts
const result = await machine.send({ type: "goToNextStep" });
if (result.error) {
  console.error("transition failed", result.error);
}

await machine.send({ type: "applyCoupon", payload: { code: "SAVE20" } });
```

The helpers cover the common moves:

```ts
await machine.goToNextStep();
await machine.goToPreviousStep();
await machine.goToLastVisitedStep();
await machine.goToStepById("review");
await machine.completeJourney();
await machine.terminateJourney();
```

`goToStepById(...)` is mode-aware: caller-driven navigation when `transitions` is omitted (headless),
and following declared `goToStepById` transitions in graph or linear definitions.

Out-of-band state changes go through their own APIs (not the transition graph):

- `updateContext(updater)` — patch context, queued and ordered
- `getStepMeta(stepId)` — read static step metadata
- `clearStepError(stepId?)` — reset a step's async error phase
- `startJourney()` / `resetJourney()` — lifecycle control

:::note
After `dispose()`, send-style APIs (`send`, `goToNextStep`, `completeJourney`) resolve with
`transitioned: false` and `error: JourneyDisposedError`. Synchronous control APIs (`startJourney`,
`updateContext`, `clearStepError`) become no-ops and emit a development warning.
:::

`updateContext` is immediate but not retroactive: it won't rebase an async transition already in
flight. If a change must affect the current `send`, apply it first; if it should land after, await
the transition. See [Async behavior](/docs/core/async) for the timing rules.

## Snapshot and computed

`getSnapshot()` returns the full runtime truth — `currentStepId`, `history`, `context`, `visited`,
`status`, `async`. The [Snapshot](/docs/core/snapshot) page is the field guide; the key invariant is
that `currentStepId === history.timeline[history.index]`.

`getComputed()` returns a read-only, memoized derived view. Always available:

`mode`, `activeStepId`, `activeStepIndex`, `visitedStepCount`, `isLoading`, `isIdle`, `isRunning`,
`isComplete`, `isTerminated`, `isInitialStep`.

Linear machines add the wizard-style fields `stepCount`, `journeyLength`, `isFirstStep`,
`isLastStep`, and `stepOrder`:

```ts
const computed = machine.getComputed();
if (computed.mode === "linear") {
  console.log(computed.activeStepIndex, computed.stepCount, computed.isLastStep);
}
```

## Observability

| Method                                    | Use it when…                                                          |
| ----------------------------------------- | --------------------------------------------------------------------- |
| `subscribe(listener)`                     | you only need to know the snapshot changed                            |
| `subscribeSelector(sel, l, eq?)`          | you care about one slice and want to skip updates when it's unchanged |
| `subscribeEvent(listener)`                | you need the typed lifecycle stream (analytics, logs, debugging)      |
| `subscribeStart/Reset/Complete/Terminate` | you want one specific lifecycle event without filtering               |

```ts
const unsubscribe = machine.subscribeSelector(
  (snapshot) => snapshot.currentStepId,
  (next, previous) => console.log(`${previous} → ${next}`)
);
```

The full lifecycle event catalog lives in [Lifecycle & events](/docs/core/lifecycle).

## Type helpers

The exports you'll reach for most:

`JourneyDefinition`, `JourneyMachine`, `JourneySnapshot`, `JourneySendEvent`, `JourneySendResult`,
`JourneyComputed`, `JourneyObservationEvent`, `JourneyPayloadFor`.

The [TypeScript](/docs/core/typescript) guide covers how to use them; the
[generated API reference](/docs/core/api/reference) has every export.

## Where to next

- [Transitions syntax](/docs/core/api/transitions-syntax) — every way to declare a transition.
- [Graph builder](/docs/core/api/graph-builder) — the typed per-step builder.
- [TypeScript](/docs/core/typescript) — generics, inference, and the patterns you'll use daily.
