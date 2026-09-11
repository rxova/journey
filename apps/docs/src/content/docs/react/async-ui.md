---
title: "Async UI"
---

Journey separates work that must succeed **before** movement from effects that settle **after**
movement. React renders both from the Core snapshot; it does not need a parallel local loading state.

Guards are synchronous. A graph guard answers only whether a candidate is enabled for the current
context and handlers. Network validation, file writes, and submissions belong in navigation work.

## Pre-commit navigation work

```tsx
function ContinueButton() {
  const snapshot = checkout.useSnapshot();
  const navigate = checkout.machine.navigate;

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

A step component can register the same work instead of passing it at the call site: the linear
bundle's `useStepHandler(stepId, work)` gates plain `goToNextStep()` for that step while the
component is mounted. A throw or rejection cancels the move and lands in
`currentStep.async.error`; timeline moves and `goToStepById` bypass the gate.

## After the move commits

This tier's step configs carry no `onEnter`/`onLeave` — `<StepRenderer>` keys the active view by
step id, so a step's component mounts on enter and unmounts on leave, and a `useEffect` with a
cleanup covers both while still reaching component state. For an observer that is not the step's
own view, `useEventEffect("stepEnter" | "stepLeave", …)` sees every move.

Either way the work runs _after_ movement commits: the destination is already current and
`transition.phase` is `"leaving"` or `"entering"`. Nothing there can roll navigation back. Use it
for analytics, cleanup, or loading destination data; use navigation work
([`useStepHandler`](#pre-commit-navigation-work)) whenever failure must prevent the move.

Core keeps `onEnter`/`onLeave` on its own step configs, for machines driven outside React — see
[Effects](../core/effects.md).

## Which loading field to read

- `snapshot.machine.isLoading` is the normal whole-flow flag.
- `snapshot.transition` shows pending state, phase, source, and destination.
- `snapshot.currentStep?.async` records loading, success, error, and the error value for the
  current entry.
- Bundle `useStep()` — linear and graph alike — returns the whole current step, including its
  `async` state, or `null` while the machine is idle; `useStep()?.async` is the focused per-step
  read.

```tsx
function ReviewError() {
  const step = checkout.useStep();
  const { machine } = checkout;

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
