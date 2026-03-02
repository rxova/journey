---
id: overview
title: Vue Overview
sidebar_label: Overview
---

import Tabs from "@theme/Tabs";
import TabItem from "@theme/TabItem";

`@rxova/journey-vue` is a thin, typed Vue wrapper around `@rxova/journey-core`.

## Motivation

See the Core motivation: [Core Motivation](/docs/core/overview#motivation).

## Architecture

Vue bindings are a wrapper layer, not a second runtime.

The bindings capture journey typing once (`createJourneyBindings`) and expose Vue-friendly APIs (`Provider`, `StepRenderer`, composables). Under the hood, transition selection, history pointer behavior, lifecycle events, async phases, and persistence all come from Core.

For the runtime architecture model, read [Core Architecture](/docs/core/architecture).

## TypeScript in Vue Bindings

TypeScript is first-class here too.

`createJourneyBindings` captures journey types once, then `useJourneyApi`, `useJourneySnapshot`, and `useJourneyMachine` stay typed without repeating generics at each callsite.

For deeper type modeling (events, payload maps, snapshots), see [Core TypeScript](/docs/core/typescript).

## What Vue Package Gives You

- `createJourneyBindings(journey)` to capture journey typing once.
- `Provider` to wire machine state into Vue context.
- `StepRenderer` to render the current step component.
- Composables for control and state:
  - `useJourneyApi()`
  - `useJourneySnapshot()`
  - `useJourneyMachine()`

This keeps Vue code ergonomic without moving core runtime logic into components.

## Vue Example

Here is the same graph style wired with Vue bindings using SFCs and a `let + ReturnType` bindings singleton.
The journey composition lives in a separate module to avoid static circular imports.

<Tabs groupId="vue-example-files" defaultValue="journey-bindings">
  <TabItem value="journey-bindings" label="journey-bindings.ts">

```ts
import { createJourneyBindings, type JourneyVueDefinition } from "@rxova/journey-vue";

type StepId = "details" | "payment" | "review";
type CustomEvent = "applyCoupon";
type Context = { isVip: boolean };

export type CheckoutJourney = JourneyVueDefinition<Context, StepId, CustomEvent>;

export let bindings: ReturnType<typeof createJourneyBindings<Context, StepId, CustomEvent>>;

export const initializeBindings = (journey: CheckoutJourney) => {
  bindings = createJourneyBindings(journey);
  return bindings;
};
```

  </TabItem>
  <TabItem value="journey" label="journey.ts">

```ts
import { createTransitions, tx } from "@rxova/journey-vue";
import Details from "./Details.vue";
import Payment from "./Payment.vue";
import Review from "./Review.vue";
import { initializeBindings, type CheckoutJourney } from "./journey-bindings";

const journey: CheckoutJourney = {
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

export const bindings = initializeBindings(journey);
```

  </TabItem>
  <TabItem value="details" label="Details.vue">

```html
<script setup lang="ts">
  import { bindings } from "./journey-bindings";
  const api = bindings.useJourneyApi();
</script>
<template>
  <button @click="api.goToNextStep()">Next</button>
</template>
```

  </TabItem>
  <TabItem value="payment" label="Payment.vue">

```html
<script setup lang="ts">
  import { bindings } from "./journey-bindings";
  const api = bindings.useJourneyApi();
</script>
<template>
  <button @click="api.send({ type: 'applyCoupon' })">Apply coupon</button>
</template>
```

  </TabItem>
  <TabItem value="review" label="Review.vue">

```html
<script setup lang="ts">
  import { bindings } from "./journey-bindings";
  const api = bindings.useJourneyApi();
</script>
<template>
  <button @click="api.completeJourney()">Finish</button>
</template>
```

  </TabItem>
  <TabItem value="app" label="App.vue">

```html
<script setup lang="ts">
  import { bindings } from "./journey";

  const Provider = bindings.Provider;
  const StepRenderer = bindings.StepRenderer;
</script>
<template>
  <Provider>
    <StepRenderer />
  </Provider>
</template>
```

  </TabItem>
</Tabs>

## What Still Lives in Core

Vue bindings do not redefine runtime behavior.

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

The split lets you keep one stable flow model while writing normal Vue components.

- Core stays deterministic and framework-agnostic.
- Vue stays focused on rendering and composable ergonomics.
- Teams can debug runtime behavior using Core mental models, then implement UI with Vue bindings.

## One-Line Mental Model

Use Vue docs for _how to wire Journey into Vue_.
Use Core docs for _how Journey actually works under the hood_.
