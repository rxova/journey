---
title: Quickstart
sidebar_position: 2
---

This quickstart shows the Vue wiring.

Runtime semantics (history, observability, persistence, async behavior) come from Core: [Core Overview](/docs/core/overview) and [Core API](/docs/core/api).

Type modeling comes from Core too: [Core TypeScript](/docs/core/typescript).

## 1) Create Typed Bindings

```ts
// journey-bindings.ts
import {
  createJourneyBindings,
  createTransitions,
  tx,
  type JourneyVueDefinition
} from "@rxova/journey-vue";
import { Start, Review } from "./steps";

type StepId = "start" | "review";
type Ctx = { name: string };

export let bindings: ReturnType<typeof createJourneyBindings<Ctx, StepId>>;

const journey: JourneyVueDefinition<Ctx, StepId> = {
  initial: "start",
  context: { name: "" },
  steps: {
    start: { component: Start },
    review: { component: Review }
  },
  transitions: createTransitions(
    tx.from("start").on("goToNextStep").to("review"),
    tx.from("review").toComplete()
  )
};

bindings = createJourneyBindings(journey);
```

## 2) Build Step Components

```vue
<!-- Start.vue -->
<script setup lang="ts">
import { bindings } from "./journey-bindings";
const api = bindings.useJourneyApi();
</script>
<template>
  <button @click="api.goToNextStep()">Next</button>
</template>

<!-- Review.vue -->
<script setup lang="ts">
import { bindings } from "./journey-bindings";
const api = bindings.useJourneyApi();
</script>
<template>
  <button @click="api.completeJourney()">Submit</button>
</template>
```

## 3) Mount Provider + StepRenderer

```vue
<!-- App.vue -->
<script setup lang="ts">
import { bindings } from "./journey-bindings";

const Provider = bindings.Provider;
const StepRenderer = bindings.StepRenderer;
</script>

<template>
  <Provider>
    <StepRenderer />
  </Provider>
</template>
```

## 4) Use Navigation Helpers

```ts
const api = bindings.useJourneyApi();

await api.goToPreviousStep(1);
await api.goToLastVisitedStep();
await api.send({ type: "goToStepById", stepId: "review" });
```

`api` is journey-typed automatically from your bindings, so event names and payload shapes are checked at compile time.

## Where To Go Next

- Composable surface and Provider behavior: [Provider and Composables API](/docs/vue/provider-and-hooks)
- Vue usage patterns: [Vue Patterns](/docs/vue/patterns)
- Async UI states in Vue: [Async UI](/docs/vue/async-ui)
- Runtime semantics (source of truth): [Core API](/docs/core/api)
