---
id: runtime
title: Runtime
---

# Runtime

`JourneyRuntime` (`src/core/runtime.ts`) is the single class that owns changing state. No
controller-per-concern layer sits between this state and the operation changing it: a lifecycle
control, context update, navigation, or graph send updates runtime state and publishes a new
snapshot at its defined boundaries.

## Runtime state {#runtime-state}

The runtime owns:

- lifecycle `status` and the recorded terminal `outcome`;
- the `timeline` array, its pointer `currentIndex` (`-1` while idle), and per-step visit counts;
- the current `context` value;
- current-entry async state and the pending-transition record (`working`, `leaving`, `entering`);
- the raised-event FIFO queue;
- a generation counter and a one-shot restore seed;
- plugin APIs, snapshot derivers, and dispose callbacks.

## The generation counter {#generation}

Terminate, restart, and dispose increment a generation counter. Every async continuation — awaited
navigation work, hook chains, raised-event draining — captures the generation it started under and
bails out when the counter has moved on, so stale continuations cannot settle a newer run.

## Initial entry and restore {#initial-entry}

`start()` moves `idle` to `running` and enters the initial step: no `onLeave` runs, `from` is
`null`, and `stepEnter` reports `direction: "jump"`.

When the machine was created with the `persist` option and a resumable record existed in storage,
the factory hands the runtime a one-shot restore seed. The first `start()` then seeds context,
timeline, and pointer from the record and re-enters the persisted current step instead of the
first/initial one. Visit counts are reconstructed from the restored timeline, so the re-entered
step reports `isFirstTimeVisit: false`. The seed is consumed on first use: `restart()` always
begins a fresh run at the first/initial step (or `startAt`). An explicit `startAt` option wins over
a persisted record. See [Persistence](../persistence#restore) for the record validity rules.

## Lifecycle and context changes {#out-of-band-changes}

Controls update status directly and publish a snapshot plus `statusChange`. Context updates replace
context synchronously and publish a snapshot plus `contextChange`.

Pause, complete, and normal navigation reject while a hook chain is pending. Terminate deliberately
wins: it invalidates pending work and clears raised events. Restart is available only after complete
or terminate and rebuilds the initial run state.

## Raised events {#raised-events}

Hook `raise(event)` appends to a graph-only FIFO. The runtime starts draining only after the current
transition settles. One cascade is capped at `MAX_RAISED_EVENTS` (25); exceeding it drops the queue
and emits an `error` event with phase `raise`.

## Timeouts {#timeouts}

`defaultTimeoutMs` wraps navigation `run` and each hook promise. A work timeout blocks movement and
returns `reason: "error"`; a post-commit hook timeout surfaces as the destination step's async
error.

## Where to next

- [Store](./store)
- [Work and transitions](./work-and-transitions)
- [Timeline & history](../history)
