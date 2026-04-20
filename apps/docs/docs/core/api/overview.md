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
  type JourneyDefinition,
  type JourneyObservationEvent,
  type JourneySnapshot
} from "@rxova/journey-core";
```

Most teams use `createJourneyMachine` with either a linear transition array or an event-keyed transition graph.

## TypeScript-First API Surface

Core exports runtime APIs and strong type helpers together.

Common type imports:

```ts
import type {
  JourneyDefinition,
  JourneyComputed,
  JourneySnapshot,
  JourneyMachine,
  JourneyPayloadFor
} from "@rxova/journey-core";
```

For a complete typing guide, see [Core TypeScript](/docs/core/typescript).

## Typical Usage Flow

```ts
import { createJourneyMachine } from "@rxova/journey-core";

const journey = {
  initial: "start",
  context: { isVip: false },
  steps: {
    start: {},
    payment: {},
    review: {}
  },
  transitions: {
    start: {
      goToNextStep: [
        { to: "review", when: ({ context }) => context.isVip },
        { to: "payment", when: ({ context }) => !context.isVip }
      ]
    },
    payment: {
      goToNextStep: [{ to: "review" }]
    }
  }
};

const journeyMachine = createJourneyMachine(journey);
journeyMachine.startJourney();
```

This pattern scales well: the flow map stays readable even when behavior gets richer.

## Working With the Machine

You can drive the machine with events (`send`) or convenience helpers.

Start it first:

```ts
journeyMachine.startJourney();
```

Use `send` when you want explicit event control:

```ts
const result = await journeyMachine.send({ type: "goToNextStep" });
if (result.error) {
  console.error("transition failed", result.error);
}

await journeyMachine.send({ type: "myCustomEvent" });
```

Use helpers for common actions:

```ts
await journeyMachine.goToNextStep();
await journeyMachine.goToPreviousStep();
await journeyMachine.goToLastVisitedStep();
await journeyMachine.goToStepById("review");
await journeyMachine.completeJourney();
await journeyMachine.terminateJourney();
```

`goToStepById(...)` is mode-aware: it performs direct caller-driven navigation when `transitions` is omitted, and follows only declared `goToStepById` transitions in graph or linear definitions.

After `dispose()`, send-style APIs such as `send(...)`, `goToNextStep()`, and `completeJourney()` resolve with `transitioned: false` and `error: JourneyDisposedError`. Sync control APIs such as `startJourney()`, `updateContext()`, and `clearStepError()` remain no-op and emit a development warning.

You can also update runtime state safely through explicit APIs:

- `updateContext(updater)`
- `getStepMeta(stepId)`
- `clearStepError(stepId?)`
- `startJourney()`
- `resetJourney()`

`updateContext(updater)` is immediate, but it is not retroactive to an async transition already in progress. If a context change must affect the current `send(...)`, apply it before sending; if it should happen after the transition, await the transition first. See [Core Async Behavior](/docs/core/async).

`updateContext(updater)` is ordered. It waits behind any in-flight queued transition work and applies the updater to the latest committed snapshot when it executes.

## Snapshot: Your Runtime Truth

`journeyMachine.getSnapshot()` gives you the full current state:

- `currentStepId`: where the user is now.
- `history.timeline`: the path they have taken.
- `history.index`: the current pointer in that path.
- `context`: shared state used by guards, transition updates, and UI.
- `visited`: whether each step has ever been entered.
- `status`: lifecycle state (`idled`, `running`, `completed`, `terminated`).
- `async`: per-step async phase and errors.

Key invariant: `currentStepId` is always `history.timeline[history.index]`.

This invariant is why navigation stays explainable and test-friendly.

## Computed State

`journeyMachine.getComputed()` gives you a read-only derived view over the current snapshot.

Always available:

- `mode`
- `activeStepId`
- `activeStepIndex`
- `visitedStepCount`
- `isLoading`
- `isIdle`
- `isRunning`
- `isComplete`
- `isTerminated`
- `isInitialStep`

Linear journeys also expose wizard-style fields:

- `stepCount`
- `journeyLength`
- `isFirstStep`
- `isLastStep`
- `stepOrder`

Example:

```ts
const computed = journeyMachine.getComputed();

if (computed.mode === "linear") {
  console.log(computed.activeStepIndex, computed.stepCount, computed.isLastStep);
}
```

`activeStepIndex` reflects the current history position. In linear mode that lines up with the fixed sequence. In graph and headless modes it reflects the user's current position in the recorded journey timeline.

Example snapshot:

```ts
const snapshot = journeyMachine.getSnapshot();

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

By default, `goToNextStep()` completes the machine when the current step declares no `goToNextStep` transition. Set `requireExplicitCompletion: true` to opt out. It does not auto-complete when a declared next transition is merely blocked by guards.

`completeJourney()` and `terminateJourney()` are shorthands for their event forms.

`goToPreviousStep(steps?)` and `goToLastVisitedStep()` move the history pointer.

`send({ type: "goToPreviousStep" })` first tries explicit `goToPreviousStep` transitions, then falls back to
pointer navigation when none match.

`send({ type: "back" })` is only meaningful if `back` is one of your custom events and your journey declares
matching `back` transitions.

## Transition Syntax

Transition syntax has its own page:

- [Transition Syntax](/docs/core/api/transitions-syntax)

It covers the linear shorthand and the graph-object syntax used by current journey definitions.

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
- `journey.reset`
- `journey.completed`
- `journey.terminated`
- `navigation.previous`
- `navigation.lastVisited`

Use `subscribeStart`, `subscribeReset`, `subscribeComplete`, or `subscribeTerminate` when you only want a specific lifecycle event without manually filtering `subscribeEvent`.

`journey.start` is emitted when `journeyMachine.startJourney()` runs. Late subscribers only observe future lifecycle events.

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

## Type Helpers You May Use

The most common exported types are:

- `JourneyDefinition`
- `JourneyMachine`
- `JourneySnapshot`
- `JourneySendEvent`
- `JourneySendResult`
- `JourneyObservationEvent`
- `JourneyPayloadFor`
