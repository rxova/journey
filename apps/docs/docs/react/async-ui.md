---
id: async-ui
title: Async UI
sidebar_label: Async UI
---

# Async UI

Most steps eventually wait on something — an effect calling an API, a guard validating input, a
delayed `after` transition. The UI has to reflect that: a spinner while work is in flight, an error
panel when it fails, the normal step once it settles. React doesn't invent any of this; it renders
the async state Journey core already tracks per step. Your job is to read one step's phase and map it
to a view.

:::info Source of truth
The _when_ and _why_ of phase changes — `invoking`, `evaluating-when`, `error`, timeouts, retries —
live in [Core async behavior](/docs/core/async) and [Effects](/docs/core/effects). This page is just
how to render them in React.
:::

## Read one step's async state with `useStepAsyncState`

`useStepAsyncState(stepId)` returns that step's `{ phase, eventType, transitionId, error }` and
re-renders only when that slice changes — so a spinner for one step doesn't re-render on unrelated
updates.

```tsx
const checkout = createJourney(definition);

const Verify = () => {
  const { phase, error } = checkout.useStepAsyncState("verify");
  const api = checkout.useJourneyApi();

  if (phase === "invoking") return <Spinner label="Verifying…" />;
  if (phase === "error") {
    return <ErrorPanel message={String(error)} onRetry={() => api.clearStepError("verify")} />;
  }
  return <VerifyForm />;
};
```

The four phases:

| Phase             | Means                                            | Typical UI                       |
| ----------------- | ------------------------------------------------ | -------------------------------- |
| `idle`            | Nothing in flight                                | Normal interactive step          |
| `invoking`        | A step [`effect`](/docs/core/effects) is running | Spinner / skeleton               |
| `evaluating-when` | An async guard (`when`) is deciding a transition | Disable controls / "validating…" |
| `error`           | A guard or effect rejected or timed out          | Recoverable error UI + retry     |

:::tip `invoking` is the effect phase
A step that declares an [`effect`](/docs/core/effects) enters `invoking` on arrival and settles to
`idle` (or routes to its `onResolved`/`onRejected` target) when the work finishes. `useStepAsyncState`
is the ergonomic way to drive a loading screen off that — no need to reach into the raw snapshot.
:::

## Whole-machine loading

For a coarse "is anything loading?" gate, read `async.isLoading` from the snapshot rather than a
single step:

```tsx
const snapshot = checkout.useJourneySnapshot();
if (snapshot.async.isLoading) return <GlobalSpinner />;
```

## Clearing errors

An `error` phase is sticky until you clear it — re-sending the same event, or clearing explicitly:

```tsx
const api = checkout.useJourneyApi();

api.clearStepError(); // current step
api.clearStepError("payment"); // a specific step
```

## A complete step view

```tsx
const StepView = ({ stepId }: { stepId: StepId }) => {
  const { phase, error } = checkout.useStepAsyncState(stepId);
  const api = checkout.useJourneyApi();

  switch (phase) {
    case "invoking":
      return <Spinner />;
    case "evaluating-when":
      return <StepContent disabled />;
    case "error":
      return <ErrorPanel message={String(error)} onRetry={() => api.clearStepError(stepId)} />;
    default:
      return <StepContent />;
  }
};
```

## Where to next

- [Effects](/docs/core/effects) — what produces the `invoking` phase, with cancellation and timeouts.
- [Core async behavior](/docs/core/async) — phase semantics, errors, and retries in depth.
- [Provider & hooks](./provider-and-hooks) — the full hook surface, including `useStepAsyncState`.
