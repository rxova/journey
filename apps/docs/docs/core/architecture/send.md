---
title: Send Pipeline
sidebar_label: Send Pipeline
---

Source file: `packages/core/src/journey-machine/send.ts`

This file turns an incoming event into either:

- a committed transition
- a committed navigation fallback
- a terminal status change
- or a non-transitioning result with optional error information

## How It Works

1. `executeSend(...)` starts by checking that the machine is still `"running"` and emits `transition.start`. If the
   runtime has already been disposed, the surrounding queue resolves a non-transitioning result with
   `JourneyDisposedError` instead of throwing.
2. `handleHeadlessSend(...)` short-circuits omitted-transition definitions:
   - `goToStepById` validates the target step and commits a direct step transition
   - `goToNextStep` and custom events resolve as no-ops
   - terminal events and `goToPreviousStep` still continue through the normal pipeline
3. `resolveTransitionsForSend(...)` then handles the graph/linear `goToStepById` special case by filtering to only matching declared `goToStepById` transitions for the requested target step.
4. `selectTransitionForSend(...)` calls `selectTransition(...)` from `helpers.ts`. While async guards are running,
   it updates `snapshot.async` through the async-state controller and passes a run-scoped `AbortSignal` into the guard args.
5. If transition selection throws or times out, the file records step error state, emits `transition.error`, and
   resolves the send result with `error` instead of rejecting.
6. If no transition matches, `handleNoTransitionMatch(...)` applies the built-in fallbacks:
   - `goToPreviousStep` falls back to history navigation
   - `goToNextStep` can auto-complete the journey when `requireExplicitCompletion` is not set and no explicit next-step
     transition was declared
   - everything else becomes a non-transitioning result
7. If a transition matched, `resolveNextContext(...)` runs its synchronous `updateContext` callback, applies timeout protection to async guard work, and returns the next context or an error result.
8. When the async work is done, the file clears the source step's async loading state, resolves the target, and
   delegates the actual snapshot commit to navigation:
   - terminal targets go through `commitTerminalTransition(...)`
   - step targets go through `commitStepTransition(...)`

## What This File Does Not Do

- It does not own the queue. That belongs to [Runtime Queue](/docs/core/architecture/runtime).
- It does not build the committed snapshot shape. That belongs to [Navigation Commits](/docs/core/architecture/navigation)
  and [Helpers](/docs/core/architecture/helpers).
- It does not store async state itself. That belongs to [Async State](/docs/core/architecture/async-state).

This separation is what keeps transition selection, snapshot commits, and async bookkeeping independently readable.

## Recommended Reading

- Read [Helpers](/docs/core/architecture/helpers) for `selectTransition(...)`, abort/timeout handling, and target
  resolution.
- Read [Navigation Commits](/docs/core/architecture/navigation) for the snapshot writes this file delegates to.
- Read [Core API Overview](/docs/core/api) and [Transitions Syntax](/docs/core/api/transitions-syntax) for the
  public version of this behavior.
- Read [Core Async Behavior](/docs/core/async) for the user-facing semantics of guard and context-update errors.
