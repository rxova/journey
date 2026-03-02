---
id: async-ui
title: Async UI
sidebar_label: Async UI
---

React does not invent async behavior; it renders async state produced by Journey core.

Source of truth for async semantics: [Core Async Behavior](/docs/core/async).

## Read Async State in React

```tsx
const snapshot = bindings.useJourneySnapshot();

const stepId = snapshot.currentStepId;
const stepAsync = snapshot.async.byStep[stepId];
const isBusy = snapshot.async.isLoading;
```

## Typical UI Mappings

`phase` comes from:

```tsx
const phase = snapshot.async.byStep[snapshot.currentStepId].phase;
```

- `phase === "evaluating-when"`: disable controls or show validating state.
- `phase === "running-effect"`: show submit/loading state.
- `phase === "error"`: show recoverable error UI.
- `phase === "idle"`: render normal interactive step UI.

## Common Component Pattern

```tsx
const StepView = () => {
  const snapshot = bindings.useJourneySnapshot();
  const api = bindings.useJourneyApi();

  const stepId = snapshot.currentStepId;
  const state = snapshot.async.byStep[stepId];

  if (state.phase === "evaluating-when" || state.phase === "running-effect") {
    return <Spinner />;
  }

  if (state.phase === "error") {
    return <ErrorPanel onRetry={() => api.clearStepError(stepId)} />;
  }

  return <MainStepContent />;
};
```

## Clearing Errors

```tsx
const api = bindings.useJourneyApi();

api.clearStepError(); // current step
api.clearStepError("payment"); // specific step
```

## Important Boundary

React bindings expose `snapshot.async`.
Core defines when and why phase transitions happen.

If you need exact timing and rules for `when`/`effect`, read [Core Async Behavior](/docs/core/async).
