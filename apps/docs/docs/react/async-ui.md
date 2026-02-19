---
id: async-ui
title: Async UI
sidebar_label: Async UI
---

Async transition phases come from `snapshot.async`.

## Read Async State

```tsx
const snapshot = bindings.useJourneySnapshot();

const currentAsync = snapshot.async.byStep[snapshot.currentStepId];
const isBusy = snapshot.async.isLoading;
```

## Typical UI Mappings

- `phase === "evaluating-when"`: guard evaluation spinner
- `phase === "running-effect"`: submit/loading state
- `phase === "error"`: render recoverable error state

## Clear Errors

```tsx
const api = bindings.useJourneyApi();
api.clearStepError();
```

You can target a specific step with `api.clearStepError(stepId)`.
