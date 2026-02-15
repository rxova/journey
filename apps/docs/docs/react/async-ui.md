---
title: Async UX in React
sidebar_position: 5
---

Journey exposes async phases per step so UI can render deterministic loading/error states.

## Async State Access

```tsx
const { snapshot } = useJourney<Ctx, StepId>();
const step = snapshot.current;
const asyncState = snapshot.async.byStep[step];
```

## Recommended Render Strategy

1. Render blocking loading view for `evaluating-when`/`running-effect`.
2. Render recoverable error view for `error`.
3. Render normal step UI for `idle`.

```tsx
if (asyncState.phase === "evaluating-when" || asyncState.phase === "running-effect") {
  return <StepSkeleton />;
}

if (asyncState.phase === "error") {
  return <ErrorState error={asyncState.error} onRetry={() => api.clearStepError(step)} />;
}
```

## Avoid Common Mistakes

- Do not manage duplicate loading booleans in local component state.
- Do not swallow rejected `api.next()`/`api.send()` promises.
- Do not clear errors globally when only one step failed.

## Backpressure and Re-Entrancy

Rapid user clicks are serialized in core queue, but still disable critical buttons while transitions are running for better UX.
