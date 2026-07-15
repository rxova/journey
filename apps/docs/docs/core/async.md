---
id: async
title: Async behavior
---

# Async behavior

Async work lives in `onLeave`, graph `onTransition`, and `onEnter`. The snapshot separates the
machine-wide transition phase from the destination step's entry result.

## Leaving phase

While `onLeave` is pending:

```ts
snapshot.transition.pending; // true
snapshot.transition.phase; // "leaving"
snapshot.machine.isLoading; // true
```

Returning `false` produces `reason: "blocked"`. Throwing, rejecting, or timing out produces
`reason: "error"` and includes the error on the navigation result. The source step remains current.

## Entering phase

The destination is already current while `onTransition` and `onEnter` run:

```ts
snapshot.transition.phase; // "entering"
snapshot.currentStep?.async.isLoading; // true when onEnter exists
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

An `onTransition` error skips `onEnter`. Both failure types emit the named `error` event and leave
the committed destination in place.

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

The timeout applies to each async hook invocation. Terminating, restarting, or disposing increments
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
