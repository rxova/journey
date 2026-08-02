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

## Selector notification

`subscribeSelector(selector, listener, equals?)` stores the last selected value per subscription.
On every publish the store re-runs the selector against the new snapshot and calls the listener
only when the equality function (`Object.is` by default) reports a change.

## Listener isolation

Selector and event-listener failures are caught per listener, so one subscriber cannot interrupt
the runtime, the publish loop, or other subscribers. A throwing selector skips that subscription
for the publish; a throwing listener is reported and the loop continues.

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
