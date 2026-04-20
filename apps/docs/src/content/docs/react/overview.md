---
title: "React Overview"
sidebar:
  label: "Overview"
---

`@rxova/journey-react` is a thin, typed React wrapper around `@rxova/journey-core`.

## Motivation

See the Core motivation: [Core Motivation](../core/overview.md#motivation).

## Architecture

React bindings are a wrapper layer, not a second runtime.

`createJourney(definition, options?)` creates the core machine immediately in `status: "idled"` and returns a `JourneyRuntime` bundle:

- `machine`
- `dispose()`
- `useJourneySnapshot()`
- `useJourneyComputed()`
- `useJourneySelector(selector, equalityFn?)`
- `useJourneyApi()`
- `useStepApi(stepId)`
- `useJourneyEvent(listener)`
- `useJourneyStepLifecycle(stepId, callbacks)`
- `JourneyProvider`
- `StepRenderer`

Hooks work without a provider for reads and manual control. `useJourneyApi()` includes `startJourney()` for provider-free flows, and `JourneyProvider` supplies the `views` map, lifecycle callbacks, and client-side auto-start for an `idled` machine.

Older React entrypoints are not part of this package surface anymore. `createJourney(...)` is the supported runtime entrypoint.

## Runtime Ownership

`createJourney(...)` is stateful.

- One call creates one machine instance immediately.
- The returned hooks and components stay bound to that specific machine instance.
- Reusing that returned runtime across multiple providers reuses the same journey state.
- Creating a second independent journey means calling `createJourney(...)` again.

This is also what keeps the API strongly typed. Once the journey is created, the returned React API already knows the valid step ids, event names, and payload shapes.

The compatibility promises for that model are documented in the shared [Stability Contract](../core/stability.md).

For the runtime architecture model, read [Core Machine Architecture](../core/architecture.md), especially the
file-level pages in that section.

## TypeScript In React

TypeScript stays first-class here too.

`createJourney(...)` captures journey types once, then the returned hooks and components stay typed without repeating generics at each callsite.

For deeper type modeling such as events, payload maps, and snapshots, see [Core TypeScript](../core/typescript.md).

## What The React Package Gives You

- `createJourney(definition, options?)`
- hooks bound to the created machine
- `useJourneyComputed()` for derived progress state and lifecycle flags
- `useStepApi(stepId)` for step-scoped custom event typing
- `useJourneyStepLifecycle(stepId, callbacks)` for step enter/leave side effects
- a `JourneyProvider` for `views` and lifecycle callbacks
- a `StepRenderer` that renders the current step view

This keeps React ergonomic without moving runtime logic into components.

Create the runtime outside render when possible. If a component must own it, memoize it and either set `disposeOnUnmount` on `JourneyProvider` or call `dispose()` manually so you do not recreate journey state on every render.

If you need isolated state per request, per card, or per mounted route boundary, create a separate runtime in each owned boundary instead of reusing one module singleton.

## React Example

```tsx
import React from "react";
import { createJourney, type JourneyViews } from "@rxova/journey-react";
import type { JourneyDefinition } from "@rxova/journey-core";

type StepId = "details" | "payment" | "review";
type Context = { isVip: boolean };
type EventMap = { applyCoupon: unknown };

const definition: JourneyDefinition<Context, StepId, EventMap> = {
  initial: "details",
  context: { isVip: false },
  steps: {
    details: { meta: { title: "Details" } },
    payment: { meta: { title: "Payment" } },
    review: { meta: { title: "Review" } }
  },
  transitions: {
    details: {
      goToNextStep: [
        { to: "review", when: ({ context }) => context.isVip },
        { to: "payment", when: ({ context }) => !context.isVip }
      ]
    },
    payment: {
      applyCoupon: [{ to: "review" }]
    }
  }
};

const checkoutJourney = createJourney(definition);

const Details = () => {
  const api = checkoutJourney.useJourneyApi();
  return <button onClick={() => void api.goToNextStep()}>Next</button>;
};

const Payment = () => {
  const api = checkoutJourney.useJourneyApi();
  return <button onClick={() => void api.send({ type: "applyCoupon" })}>Apply coupon</button>;
};

const Review = () => {
  const api = checkoutJourney.useJourneyApi();
  return <button onClick={() => void api.completeJourney()}>Finish</button>;
};

const views: JourneyViews<StepId> = {
  details: Details,
  payment: Payment,
  review: Review
};

export const App = () => (
  <checkoutJourney.JourneyProvider views={views}>
    <checkoutJourney.StepRenderer />
  </checkoutJourney.JourneyProvider>
);
```

Guard and `updateContext` failures resolve through `result.error` instead of rejecting, so fire-and-forget button handlers like `void api.goToNextStep()` do not surface as unhandled promise rejections.

## What Still Lives In Core

React bindings do not redefine runtime behavior.

Core docs remain the source of truth for:

- architecture and transition model: [Core Architecture](../core/architecture.md)
- snapshot shape and invariants: [Core Snapshot](../core/snapshot.md)
- lifecycle events and ordering: [Core Lifecycle](../core/lifecycle.md)
- async guard behavior: [Core Async Behavior](../core/async.md)
- timeline navigation model: [Core Timeline Navigation](../core/history.md)
- persistence and migration: [Core Persistence](../core/persistence.md)
- full machine API semantics: [Core API](../core/api/overview.md)

## Why This Split Is Useful

- Core stays deterministic and framework-agnostic.
- React stays focused on rendering and hook ergonomics.
- Teams debug runtime behavior with Core mental models, then implement UI with React bindings.

## One-Line Mental Model

Use React docs for how to wire Journey into React.
Use Core docs for how Journey works under the hood.
