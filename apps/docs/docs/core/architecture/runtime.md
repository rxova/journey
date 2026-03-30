---
title: Runtime Queue And Observation Hub
sidebar_label: Runtime Queue
---

Source file: `packages/core/src/journey-machine/runtime.ts`

This file is the mutable heart of the machine.

It owns the current snapshot, the subscription sets, the lifecycle event stream, and the serialized execution
queue used by sends and navigation helpers.

## How It Works

1. `snapshot` is kept in closure state. `getSnapshot()` reads it, and `setSnapshot(...)` writes it while optionally
   notifying listeners and forwarding the change to plugin hooks.
2. `queue(...)` is the concurrency boundary. Every caller gets chained onto `actionQueue`, so each operation runs to
   a stable result before the next one mutates the machine.
3. The queue captures a `runVersion`. If `cancelInFlight()` increments the lifecycle version, older async work can
   still finish locally, but its writes are ignored because `isRunActive(runVersion)` returns `false`.
4. `subscribe(...)` stores raw snapshot listeners. `subscribeSelector(...)` layers on top of that by caching the
   selected value and skipping listener calls when the equality function says nothing changed.
5. `subscribeEvent(...)` manages lifecycle listeners and immediately sends the startup event to new subscribers so
   observers have a consistent starting point.
6. Listener failures stay isolated. If `onListenerError` is omitted, the runtime reports them through a
   development-only `console.error(...)` fallback instead of swallowing them completely silently.
7. `dispose()` marks the runtime as closed, cancels queued work, clears every listener set, and forwards disposal to
   any external cleanup hook.

This file deliberately does not know how transitions are chosen. It only guarantees safe ordering, observable state,
and consistent cancellation.

## Recommended Reading

- Read [Send Pipeline](/docs/core/architecture/send) for the code that runs inside this queue.
- Read [Async State](/docs/core/architecture/async-state) for the run-version-aware writes used by async guards.
- Read [Lifecycle](/docs/core/lifecycle) and [Snapshot](/docs/core/snapshot) for the public semantics exposed by
  this runtime.
