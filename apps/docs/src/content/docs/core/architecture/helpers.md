---
title: "Machine Helpers"
sidebar:
  label: "Helpers"
---

Source file: `packages/core/src/journey-machine/helpers.ts`

This file holds the shared pure utilities used across the machine controllers.

It is intentionally broad but not stateful. The controllers call into it for validation, snapshot construction,
transition selection, timeout handling, and send-result shaping.

## How It Works

The helpers in this file fall into a few groups:

- Validation helpers:
  - `assertStepExists(...)`
  - `validateFiniteTimeout(...)`
  - `validateJourneyTransitions(...)`
- Snapshot helpers:
  - `buildIdleStepAsyncState(...)`
  - `buildInitialAsyncState(...)`
  - `buildVisitedFromTimeline(...)`
  - `appendVisited(...)`
  - `buildSnapshot(...)`
  - `transitionSnapshot(...)`
- Transition helpers:
  - `isGoToStepByIdEvent(...)`
  - `isTerminalTarget(...)`
  - `resolveTransitionTarget(...)`
  - `selectTransition(...)`
- Execution helpers:
  - `isPromiseLike(...)`
  - `withAbortSignal(...)`
  - `withTimeout(...)`
  - `JourneyTimeoutError`
- Result helpers:
  - `normalizeStepCount(...)`
  - `buildSendResult(...)`
  - `now()`

## The Most Important Behaviors

`selectTransition(...)` is the file's most important runtime helper. It scans the ordered transition list, filters
by `from` and `event`, evaluates guards in order, and returns the first allowed transition. Async guards can report
start, success, and error events through optional hooks, which is how `send.ts` integrates async-state updates.

`buildSnapshot(...)` and `transitionSnapshot(...)` are the core snapshot constructors. They keep the history pointer
safe, normalize visited flags, and preserve the rule that timeline history is the realized path rather than a simple
step index.

The async execution helpers compose runtime cancellation with per-transition timeouts. `withAbortSignal(...)` makes
the machine stop waiting as soon as the runtime queue signal aborts, while `withTimeout(...)` keeps async guards from
hanging forever when a timeout was configured.

The overall role of this file is to keep the controller files focused on orchestration rather than on re-implementing
shared data-shaping logic.

## Recommended Reading

- Read [Send Pipeline](./send.md) for the main consumer of `selectTransition(...)`,
  `resolveTransitionTarget(...)`, and abort/timeout helpers.
- Read [Navigation Commits](./navigation.md) for the main consumer of
  `buildSnapshot(...)` and `transitionSnapshot(...)`.
- Read [Snapshot](../snapshot.md), [Async](../async.md), and [History](../history.md) for the
  public semantics these helpers preserve.
