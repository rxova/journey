---
title: "Async behavior"
---

Async work can run before a next/previous move and in post-commit lifecycle effects. The snapshot
keeps both paths in the machine's transition state.

For ordinary UI loading state, use `snapshot.transition.pending`. It stays `true` across both
pre-commit work and post-commit effects. Use `transition.phase` and `currentStep.async` only when
the UI needs more detailed progress or error information.

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
the runtime generation so stale continuations cannot settle machine state.

Work — a graph send's `run`, or navigation work passed to `goToNextStep` and friends — receives a
`signal`, and `commit` receives the same one. It aborts when the runtime stops waiting for the call:
on a timeout (its `reason` is the timeout error) or when the machine is terminated, restarted, or
disposed. Hand it to the I/O so a call nobody is waiting for stops instead of running on:

```ts
on: {
  SUBMIT: {
    run: ({ signal }) => fetch("/api/submit", { method: "POST", signal }),
    timeoutMs: 10_000,
    candidates: [{ to: "done" }]
  }
}
```

A call that finishes, or fails on its own, keeps a signal that never aborts. Hooks do not receive
one.

## Retrying work

`retry(run, options)` wraps a work `run` so a failure tries it again. It is a plain function around
`run`, not a runtime feature, so it works on graph send work, `always` work and linear navigation
work alike, and a machine that never retries pays nothing for it:

```ts
import { retry } from "@rxova/journey-core";

SUBMIT: {
  run: retry(({ handlers, signal }) => handlers.api.submit({ signal }), {
    attempts: 3, // tries in all, the first included
    delayMs: (attempt) => 200 * 2 ** attempt, // or a number; defaults to 0
    when: (error) => !(error instanceof ValidationError), // defaults to every failure
    timeoutMs: 2_000 // one try's budget
  }),
  candidates: [{ to: "done" }]
}
```

- Each try gets a `signal` of its own and its 1-based `attempt`. A try's signal aborts when its
  `timeoutMs` runs out, which counts as a failure, and when the work's own signal aborts.
- The work's own signal also cuts the wait between tries short: terminating, restarting or
  disposing the machine stops the loop, and no further try starts.
- The work's `timeoutMs` (or `defaultTimeoutMs`) still bounds all the tries together.
- The snapshot stays in the `"working"` phase across tries. Only the last failure is reported,
  rethrown as it was.
- `commit` is not retried: it runs once, on the result of the try that succeeded.
- `attempts` that is not a positive integer, or a `timeoutMs` that is not a positive finite number,
  throws a `JourneyError` coded `invalid-retry` when the wrapper is built.

`retry` takes its argument types from the work it is declared on. In a graph definition that means
pinning the types with [`withGraphTypes`](../api/with-types): then `handlers`, `signal` and
`attempt` are typed inside the wrapped `run`. `defineWork` cannot read the result's type back
through the wrapper, so give `commit` a typed `result` through the bag's `results`.

## Raised events

Graph hooks should use `raise(event)` to enqueue follow-up work. The queue runs only after the
current transition settles, preventing re-entrant navigation. A cascade beyond
`MAX_RAISED_EVENTS` is dropped and emitted as an `error` with phase `"raise"`.

A step's `always` move runs once the entry settles, before raised events drain, and the call that
entered the step waits for the whole chain. A chain longer than `maxAutoSteps` stops and is
emitted as an `error` with phase `"always"`.

## Where to next

- [Effects](./effects)
- [Snapshot](./snapshot)
- [How it works](./architecture)
