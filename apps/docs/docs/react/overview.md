---
id: overview
title: React Overview
sidebar_label: Overview
---

`@rxova/journey-react` is a thin, typed React wrapper around `@rxova/journey-core`.

## Motivation

See the Core motivation: [Core Motivation](/docs/core/overview#motivation).

## Architecture

React bindings are a wrapper layer, not a second runtime.

The bindings capture journey typing once (`createJourneyBindings`) and expose React-friendly APIs (`Provider`, `StepRenderer`, hooks). Under the hood, transition selection, history pointer behavior, lifecycle events, async phases, and persistence all come from Core.

For the runtime architecture model, read [Core Architecture](/docs/core/architecture).

## TypeScript in React Bindings

TypeScript is first-class here too.

`createJourneyBindings` captures journey types once, then `useJourneyApi`, `useJourneySnapshot`, `useJourneySelector`, `useJourneyEvent`, and `useJourneyMachine` stay typed without repeating generics at each hook call.

For deeper type modeling (events, payload maps, snapshots), see [Core TypeScript](/docs/core/typescript).

## What React Package Gives You

- `createJourneyBindings(journey)` to capture journey typing once.
- `Provider` to wire machine state into React context.
- `StepRenderer` to render the current step component.
- Hooks for control and state:
  - `useJourneyApi()`
  - `useJourneyEvent(listener)`
  - `useJourneySnapshot()`
  - `useJourneySelector(selector, equalityFn?)`
  - `useJourneyMachine()`

This keeps React code ergonomic without moving core runtime logic into components.

## React Example

Here is the same graph style wired with React bindings:

```tsx
import React from "react";
import {
  createJourneyBindings,
  createTransitions,
  tx,
  type JourneyReactDefinition
} from "@rxova/journey-react";

type StepId = "details" | "payment" | "review";
type CustomEvent = "applyCoupon";
type Context = { isVip: boolean };

let bindings: ReturnType<typeof createJourneyBindings<Context, StepId, CustomEvent>>;

const Details = () => {
  const api = bindings.useJourneyApi();
  return <button onClick={() => void api.goToNextStep()}>Next</button>;
};

const Payment = () => {
  const api = bindings.useJourneyApi();
  return <button onClick={() => void api.send({ type: "applyCoupon" })}>Apply coupon</button>;
};

const Review = () => {
  const api = bindings.useJourneyApi();
  return <button onClick={() => void api.completeJourney()}>Finish</button>;
};

const journey: JourneyReactDefinition<Context, StepId, CustomEvent> = {
  initial: "details",
  context: { isVip: false },
  steps: {
    details: { component: Details },
    payment: { component: Payment },
    review: { component: Review }
  },
  transitions: createTransitions(
    tx
      .from("details")
      .on("goToNextStep")
      .choose(tx.when(({ context }) => context.isVip).to("review"), tx.otherwise().to("payment")),
    tx.from("payment").on("applyCoupon").to("review"),
    tx.from("review").toComplete()
  )
};

bindings = createJourneyBindings(journey);

export const App = () => {
  const Provider = bindings.Provider;
  const StepRenderer = bindings.StepRenderer;

  return (
    <Provider>
      <StepRenderer />
    </Provider>
  );
};
```

## What Still Lives in Core

React bindings do not redefine runtime behavior.

Core docs remain the source of truth for:

- architecture and transition model: [Core Architecture](/docs/core/architecture)
- snapshot shape and invariants: [Core Snapshot](/docs/core/snapshot)
- lifecycle events and ordering: [Core Lifecycle](/docs/core/lifecycle)
- async guards/effects semantics: [Core Async Behavior](/docs/core/async)
- timeline navigation model: [Core Timeline Navigation](/docs/core/history)
- persistence and migration: [Core Persistence](/docs/core/persistence)
- full machine API semantics: [Core API](/docs/core/api)

If you want to understand observability, persistence, or transition internals, go to Core first.

## Why This Split Is Useful

The split lets you keep one stable flow model while writing normal React components.

- Core stays deterministic and framework-agnostic.
- React stays focused on rendering and hook ergonomics.
- Teams can debug runtime behavior using Core mental models, then implement UI with React bindings.

## One-Line Mental Model

Use React docs for _how to wire Journey into React_.
Use Core docs for _how Journey actually works under the hood_.
