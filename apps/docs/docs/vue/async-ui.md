---
id: async-ui
title: Async UI
sidebar_label: Async UI
---

Vue does not invent async behavior; it renders async state produced by Journey core.

Source of truth for async semantics: [Core Async Behavior](/docs/core/async).

## Read Async State in Vue

```ts
const snapshot = bindings.useJourneySnapshot();

const stepId = snapshot.value.currentStepId;
const stepAsync = snapshot.value.async.byStep[stepId];
const isBusy = snapshot.value.async.isLoading;
```

## Typical UI Mappings

`phase` comes from:

```ts
const phase = snapshot.value.async.byStep[snapshot.value.currentStepId].phase;
```

- `phase === "evaluating-when"`: disable controls or show validating state.
- `phase === "running-effect"`: show submit/loading state.
- `phase === "error"`: show recoverable error UI.
- `phase === "idle"`: render normal interactive step UI.

## Common Component Pattern

```vue
<script setup lang="ts">
import { computed } from "vue";

const snapshot = bindings.useJourneySnapshot();
const api = bindings.useJourneyApi();

const stepId = computed(() => snapshot.value.currentStepId);
const state = computed(() => snapshot.value.async.byStep[stepId.value]);
</script>

<template>
  <Spinner v-if="state.phase === 'evaluating-when' || state.phase === 'running-effect'" />
  <ErrorPanel v-else-if="state.phase === 'error'" @retry="api.clearStepError(stepId)" />
  <MainStepContent v-else />
</template>
```

## Clearing Errors

```ts
const api = bindings.useJourneyApi();

api.clearStepError(); // current step
api.clearStepError("payment"); // specific step
```

## Important Boundary

Vue bindings expose `snapshot.async`.
Core defines when and why phase transitions happen.

If you need exact timing and rules for `when`/`effect`, read [Core Async Behavior](/docs/core/async).
