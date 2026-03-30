---
title: Async State Tracking
sidebar_label: Async State
---

Source file: `packages/core/src/journey-machine/async-state.ts`

This file owns `snapshot.async`.

It does not run guards or context updates itself. Instead, it gives the send pipeline a small set of state transitions:
`evaluating-when`, `error`, and `idle`.

## How It Works

1. The controller starts by counting how many steps are already in a loading phase. That lets it keep
   `snapshot.async.isLoading` accurate without recomputing the whole object on every write.
2. `updateStepAsync(...)` is the core primitive. It reads the current step async state, applies an updater, and
   exits early if nothing changed.
3. If the caller provided a `runVersion`, the controller checks `runtime.isRunActive(runVersion)` before writing.
   That is how canceled async work avoids mutating a newer machine run.
4. When a step changes between idle and loading phases, the controller updates the internal `loadingCount` and
   writes a new snapshot with reason `"async"`.
5. The public helpers `setStepLoading`, `setStepIdle`, and `setStepError` are just thin wrappers over
   `updateStepAsync(...)`.

The important design choice is that async truth lives in the snapshot, not in hidden controller-local flags. UI,
plugins, and debugging tools can all inspect the same async state.

## Recommended Reading

- Read [Send Pipeline](/docs/core/architecture/send) to see who calls this controller.
- Read [Runtime Queue](/docs/core/architecture/runtime) to see how `runVersion` cancellation works.
- Read [Core Async Behavior](/docs/core/async) for the public semantics of guards, errors, and timeouts.
- Read [Snapshot](/docs/core/snapshot) if you want the full runtime state shape.
