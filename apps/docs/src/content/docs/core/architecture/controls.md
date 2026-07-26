---
title: "Controls And Out-of-Band Mutations"
sidebar:
  label: "Controls"
---

Source file: `packages/core/src/journey-machine/controls.ts`

This file owns the mutations that are intentionally not part of transition matching.

That includes machine reset, direct context updates, clearing async errors, and final disposal.

## How It Works

1. `resetJourney()` cancels in-flight queued work, rebuilds a clean snapshot from the initial step and initial
   context, syncs the async controller to that new async object, and writes the snapshot with reason `"reset"`.
2. `updateContext(...)` applies an updater to the current context and commits the result with reason `"context"`.
   No transition selection happens here.
3. `updateContext(...)` runs through the runtime queue so it applies after earlier queued work and rebases
   against the latest committed snapshot when it executes.
4. `clearStepError(...)` delegates to the async-state controller so the error reset logic stays in one place.
5. `dispose()` simply forwards to `runtime.dispose()`, which clears listeners and cancels queued work.

This split keeps the event pipeline honest. Transition-driven movement stays in `send.ts` and `navigation.ts`,
while maintenance operations stay here.

## Recommended Reading

- Read [createJourneyMachine](./create-journey-machine.md) to see where this controller is
  created and exposed on the public machine.
- Read [Runtime Queue](./runtime.md) for snapshot commit behavior.
- Read [Async State](./async-state.md) for the error and loading fields this file manipulates.
- Read [Lifecycle](../lifecycle.md) and [Snapshot](../snapshot.md) for the public runtime effects of
  these mutations.
