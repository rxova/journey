---
id: async-ui
title: Async UI
sidebar_label: Async UI
---

# Async UI

Journey separates work that must succeed **before** movement from effects that settle **after**
movement. React renders both from the Core snapshot; it does not need a parallel local loading state.

Guards are synchronous. A graph guard answers only whether a candidate is enabled for the current
context and handlers. Network validation, file writes, and submissions belong in navigation work.

## Pre-commit navigation work

```tsx
function ContinueButton() {
  const snapshot = checkout.useSnapshot();
  const navigate = checkout.useNavigation();

  const continueJourney = async () => {
    const result = await navigate.goToNextStep({
      run: ({ snapshot }) => orders.save(snapshot.context),
      commit: ({ result: order, updateContext }) => {
        updateContext((context) => ({
          ...context,
          orderId: order.id
        }));
      }
    });

    if (!result.ok && result.reason === "error") {
      report(result.error);
    }
  };

  return (
    <button disabled={snapshot.machine.isLoading} onClick={() => void continueJourney()}>
      {snapshot.machine.isLoading ? "Saving…" : "Continue"}
    </button>
  );
}
```

While `run` is pending, the source step remains current and
`snapshot.transition.phase === "working"`. If it fails, position and context stay unchanged. A
successful synchronous `commit` publishes context and position together.

## Post-commit hooks

Core step `onLeave` and `onEnter` hooks run after movement commits. During them, the destination
is already current and `transition.phase` is `"leaving"` or `"entering"`. A hook error is
observable but does not roll navigation back.

Use hooks for analytics, cleanup, or loading destination data. Use navigation work whenever failure
must prevent movement.

## Which loading field to read

- `snapshot.machine.isLoading` is the normal whole-flow flag.
- `snapshot.transition` shows pending state, phase, source, and destination.
- `snapshot.currentStep.async` records loading, success, error, and the error value for the current
  entry.
- Graph `useStep()` returns the whole current step — including its `async` state — and headless
  `useStepAsyncState(machine, stepId)` provides a focused per-step subscription.

```tsx
function ReviewError() {
  const step = checkout.useStep();
  const machine = checkout.useMachine();

  if (step?.id !== "review" || !step.async.isError) return null;

  return (
    <aside>
      <ErrorMessage error={step.async.error} />
      <button onClick={() => machine.async.clearError()}>Dismiss</button>
    </aside>
  );
}
```

## Concurrency and results

Only one navigation settles at a time. A concurrent attempt resolves with
`{ ok: false, reason: "transitioning" }`. Expected navigation failures resolve rather than reject,
so `void navigate.goToNextStep()` is safe in a click handler.

Termination, restart, and disposal invalidate stale async continuations. A late hook completion
cannot resurrect a terminated or disposed machine.
