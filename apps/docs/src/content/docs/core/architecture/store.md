---
title: "Store"
---

`JourneyStore` (`src/core/store.ts`) holds the latest immutable snapshot and distributes it. It has
two jobs:

1. Hold the latest snapshot and notify selector listeners when their selected value changes.
2. Deliver named lifecycle payloads (`stepEnter`, `stepLeave`, `statusChange`, `contextChange`,
   `navigationBlocked`, `error`) to listeners for that event.

The store never derives state itself. Snapshots are rebuilt by the runtime; the store only
publishes them.

## Notification

`subscribe(listener)` registers a plain per-commit callback. Publishing replaces the snapshot and
calls every listener; a publish whose snapshot is reference-equal to the current one is skipped
entirely, because structural sharing upstream returns the previous object verbatim when nothing
changed.

The store holds no selectors and no equality functions. Deriving a slice and suppressing unchanged
values is a rendering concern, and it needs to know which renders committed — so it lives in the
framework binding (`useSelector` in `@rxova/journey-react`), not here.

## Listener isolation

Listener failures are caught per listener, so one subscriber cannot interrupt the runtime, the
publish loop, or other subscribers. A throwing listener is reported and the loop continues.

Isolation is unconditional. What you can configure is where the report goes: the `onListenerError`
creation option receives the thrown value. Without it, the store reports through `console.error`.
If the configured reporter itself throws, the store falls back to the default `console.error`
report — a broken reporter can never re-enter the runtime.

```ts
const machine = createLinearJourney(definition, {
  onListenerError: (error) => errorTracker.capture(error)
});
```

## Disposal

Disposing the machine drops every selector and event subscription. Later `subscribe*` calls return
a no-op unsubscribe.

## Where to next

- [Runtime](./runtime)
- [Machine surface](./machine-surface)
- [Lifecycle and events](../lifecycle)
