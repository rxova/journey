---
title: "Async State Tracking"
sidebar:
  label: "Async State"
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

- Read [Send Pipeline](./send.md) to see who calls this controller.
- Read [Runtime Queue](./runtime.md) to see how `runVersion` cancellation works.
- Read [Core Async Behavior](../async.md) for the public semantics of guards, errors, and timeouts.
- Read [Snapshot](../snapshot.md) if you want the full runtime state shape.
