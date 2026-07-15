---
id: async
title: Async behavior
---

# Async behavior

Async work can run before a next/previous move and in post-commit lifecycle effects. The snapshot
keeps both paths in the machine's transition state.

For ordinary UI loading state, use `snapshot.machine.isLoading`. It mirrors
`snapshot.transition.pending` across pre-commit work and post-commit effects. Use `transition.phase`
and `currentStep.async` only when the UI needs more detailed progress or error information.

## Working phase

Pass work when an operation must succeed before the step changes:

```ts
const result = await machine.navigate.goToNextStep({
  run: async ({ snapshot }) => authenticate(snapshot.context.credentials),
  commit: ({ result, updateContext }) => {
    updateContext((context) => ({ ...context, user: result.user, password: "" }));
  }
});
```

While `run` is pending, the source remains current and `transition.phase` is `"working"`. Throwing,
rejecting, timing out, or throwing from `commit` returns `reason: "error"`; neither position nor
staged context changes. `commit` must be synchronous.

`goToPreviousStep(work)` and `goToPreviousStep(n, work)` use the same contract.

## Lifecycle-effect phases

The destination is already current while `onLeave`, `onTransition`, and `onEnter` run:

```ts
snapshot.transition.phase; // "leaving" or "entering"
snapshot.currentStep?.async.isLoading; // true while effects settle
```

After settling, current-step async state is either successful or contains the post-commit failure:

```ts
snapshot.currentStep?.async = {
  isLoading: false,
  isSuccess: false,
  isError: true,
  error
};
```

Each effect is attempted even when an earlier effect fails. Failures emit the named `error` event
and leave the committed destination in place.

## Concurrent calls

Only one navigation hook chain runs at a time. Another navigation or graph send resolves with:

```ts
{ ok: false, reason: "transitioning" }
```

Context updates are synchronous and can occur while hooks are pending. Hooks receive the snapshot
captured when their argument object is created; call the provided updater to apply against the
runtime's current context.

## Timeouts and invalidation

```ts
const machine = createLinearJourney(definition, {
  defaultTimeoutMs: 5_000
});
```

The timeout applies to navigation `run` and each async hook invocation. Terminating, restarting, or disposing increments
the runtime generation so stale continuations cannot settle machine state. Journey does not supply
an `AbortSignal`; cancel underlying I/O in your own integration when needed.

## Raised events

Graph hooks should use `raise(event)` to enqueue follow-up work. The queue runs only after the
current transition settles, preventing re-entrant navigation. A cascade beyond
`MAX_RAISED_EVENTS` is dropped and emitted as an `error` with phase `"raise"`.

## Where to next

- [Effects](./effects)
- [Snapshot](./snapshot)
- [How it works](./architecture)
