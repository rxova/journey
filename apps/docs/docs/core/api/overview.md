---
title: Core API
sidebar_label: Overview
slug: /api
---

This API is designed around one practical goal: help you define a flow once, then drive it predictably at runtime.

## API Stability Baseline

Starting with `0.6.0`, this API is treated as a stabilization baseline.
In `0.6.x`, prefer additive and bug-fix changes, and avoid breaking API changes unless they are explicitly documented with migration guidance.

## What You Import

```ts
import {
  createJourneyMachine,
  createTransitions,
  tx,
  JOURNEY_STATUS,
  JOURNEY_EVENT,
  JOURNEY_ASYNC_PHASE,
  JOURNEY_WILDCARD
} from "@rxova/journey-core";
```

Most teams use `createJourneyMachine`, `createTransitions`, and `tx` every day.

## TypeScript-First API Surface

Core exports runtime APIs and strong type helpers together.

Common type imports:

```ts
import type {
  JourneyDefinition,
  JourneySnapshot,
  JourneyMachine,
  JourneyEvent,
  JourneyPayloadFor
} from "@rxova/journey-core";
```

For a complete typing guide, see [Core TypeScript](/docs/core/typescript).

## Typical Usage Flow

```ts
import { createJourneyMachine, createTransitions, tx } from "@rxova/journey-core";

const journey = {
  initial: "start",
  context: { isVip: false },
  steps: {
    start: {},
    payment: {},
    review: {}
  },
  transitions: createTransitions(
    tx
      .from("start")
      .on("goToNextStep")
      .choose(tx.when(({ context }) => context.isVip).to("review"), tx.otherwise().to("payment")),
    tx.from("payment").on("goToNextStep").to("review"),
    tx.from("review").toComplete()
  )
};

const machine = createJourneyMachine(journey);
```

This pattern scales well: the flow map stays readable even when behavior gets richer.

## Working With the Machine

You can drive the machine with events (`send`) or convenience helpers.

Use `send` when you want explicit event control:

```ts
await machine.send({ type: "goToNextStep" });
await machine.send({ type: "myCustomEvent" });
```

Use helpers for common actions:

```ts
await machine.goToNextStep();
await machine.goToPreviousStep();
await machine.goToLastVisitedStep();
await machine.completeJourney();
await machine.terminateJourney();
```

You can also update runtime state safely through explicit APIs:

- `updateContext(updater)`
- `updateStepMetadata(stepId, updater)`
- `clearStepError(stepId?)`
- `resetMachine()`

`updateContext(updater)` is immediate, but it is not retroactive to an async transition already in progress. If a context change must affect the current `send(...)`, apply it before sending; if it should happen after the transition, await the transition first. See [Core Async Behavior](/docs/core/async).

## Snapshot: Your Runtime Truth

`machine.getSnapshot()` gives you the full current state:

- `currentStepId`: where the user is now.
- `history.timeline`: the path they have taken.
- `history.index`: the current pointer in that path.
- `context`: shared state used by guards/effects/UI.
- `visited`: whether each step has ever been entered.
- `stepMeta`: per-step runtime metadata.
- `status`: lifecycle state (`running`, `complete`, `terminated`).
- `async`: per-step async phase and errors.

Key invariant: `currentStepId` is always `history.timeline[history.index]`.

This invariant is why navigation stays explainable and test-friendly.

Example snapshot:

```ts
const snapshot = machine.getSnapshot();

const exampleSnapshot = {
  currentStepId: "payment",
  history: {
    timeline: ["start", "details", "payment"],
    index: 2
  },
  context: {
    isVip: false
  },
  visited: {
    start: true,
    details: true,
    payment: true,
    review: false
  },
  stepMeta: {
    start: {},
    details: {},
    payment: {},
    review: {}
  },
  status: "running",
  async: {
    isLoading: false,
    byStep: {
      start: { phase: "idle", eventType: null, transitionId: null, error: null },
      details: { phase: "idle", eventType: null, transitionId: null, error: null },
      payment: { phase: "idle", eventType: null, transitionId: null, error: null },
      review: { phase: "idle", eventType: null, transitionId: null, error: null }
    }
  }
};
```

## Navigation Semantics

`goToNextStep()` is shorthand for sending `goToNextStep`.

`completeJourney()` and `terminateJourney()` are shorthands for their event forms.

`goToPreviousStep(steps?)` and `goToLastVisitedStep()` move the history pointer.

`send({ type: "back" })` first tries explicit `back` transitions, then falls back to `goToPreviousStep(1)` when none match.

## Transition Syntax

Transition syntax has its own page:

- [Transition Syntax](/docs/core/api/transitions-syntax)

It covers plain transition objects, `tx` helpers, and when to use each style.

## Observability

Use `subscribe` when you only care that snapshot changed.

Use `subscribeSelector` when you only care about a specific snapshot slice and want to skip updates when that selected value is unchanged.

Use `subscribeEvent` when you need typed lifecycle telemetry, such as:

- `journey.start`
- `transition.start`
- `transition.success`
- `transition.error`
- `step.enter`
- `step.exit`
- `journey.complete`
- `journey.close`
- `navigation.previous`
- `navigation.lastVisited`
- `metadata.updated`

Use `subscribeStart`, `subscribeComplete`, or `subscribeTerminate` when you only want a specific lifecycle event without manually filtering `subscribeEvent`.

`journey.start` is replayed immediately to each `subscribeEvent` listener so late subscribers can still observe machine startup.

For teams, this usually means better logs, easier debugging, and cleaner analytics hooks.

In practice:

- Better logs: you can log transition and navigation events with consistent payloads.
- Easier debugging: you can reconstruct what happened and why a transition failed.
- Cleaner analytics hooks: event listeners can feed analytics without adding tracking logic inside UI components.

Selector subscription example:

```ts
const unsubscribeStep = machine.subscribeSelector(
  (snapshot) => snapshot.currentStepId,
  (next, previous) => {
    console.log("step changed:", previous, "->", next);
  }
);

const unsubscribeStepObject = machine.subscribeSelector(
  (snapshot) => ({ step: snapshot.currentStepId }),
  (next) => {
    console.log("selected object changed:", next.step);
  },
  (previous, next) => previous.step === next.step
);
```

## Constants You May Use

- `JOURNEY_STATUS`: lifecycle status constants.
- `JOURNEY_EVENT`: built-in event identifiers.
- `JOURNEY_ASYNC_PHASE`: async transition phase constants.
- `JOURNEY_WILDCARD`: wildcard source for transitions.

Values:

```ts
JOURNEY_STATUS = {
  RUNNING: "running",
  COMPLETE: "complete",
  TERMINATED: "terminated"
};

JOURNEY_EVENT = {
  GO_TO_STEP_BY_ID: "goToStepById"
};

JOURNEY_ASYNC_PHASE = {
  IDLE: "idle",
  EVALUATING_WHEN: "evaluating-when",
  RUNNING_EFFECT: "running-effect",
  ERROR: "error"
};

JOURNEY_WILDCARD = "*";
```

These are optional helpers for readability and consistency.
