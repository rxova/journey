---
id: api
title: Core API
sidebar_label: API
---

## Exports

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

## Snapshot Model

```ts
type JourneySnapshot<TContext, TStepId extends string, TStepMeta = unknown> = {
  currentStepId: TStepId;
  history: {
    timeline: readonly TStepId[];
    index: number;
  };
  context: TContext;
  visited: Record<TStepId, boolean>;
  stepMeta: Record<TStepId, TStepMeta>;
  status: "running" | "complete" | "terminated";
  async: JourneyAsyncState<TStepId>;
};
```

`currentStepId` is always `history.timeline[history.index]`.

## Machine API

```ts
type JourneyMachine<...> = {
  getSnapshot(): JourneySnapshot<...>;
  send(event): Promise<JourneySendResult<...>>;
  goToNextStep(): Promise<JourneySendResult<...>>;
  terminateJourney(payload?): Promise<JourneySendResult<...>>;
  completeJourney(payload?): Promise<JourneySendResult<...>>;
  goToPreviousStep(steps?: number): Promise<JourneySendResult<...>>;
  goToLastVisitedStep(): Promise<JourneySendResult<...>>;
  updateContext(updater): JourneySnapshot<...>;
  updateStepMetadata(stepId, updater): JourneySnapshot<...>;
  clearStepError(stepId?): JourneySnapshot<...>;
  resetMachine(): JourneySnapshot<...>;
  subscribe(listener: () => void): () => void;
  subscribeEvent(listener: (event: JourneyObservationEvent<...>) => void): () => void;
};
```

## Navigation Semantics

- `goToNextStep()`: convenience for `send({ type: "goToNextStep" })`.
- `terminateJourney(payload?)`: convenience for `send({ type: "terminateJourney", payload? })`.
- `completeJourney(payload?)`: convenience for `send({ type: "completeJourney", payload? })`.
- `goToPreviousStep(steps?)`: pointer move toward index `0` (clamped).
- `goToLastVisitedStep()`: pointer move to `history.timeline.length - 1`.
- `send({ type: "back" })`:

1. tries explicit matching back transitions first
2. if none matches, falls back to `goToPreviousStep(1)`.

## Transition Ergonomics

Use builders and compile to flat transitions:

```ts
const transitions = createTransitions(
  tx.from("start").on("goToNextStep").to("details"),
  tx
    .from("details")
    .on("goToNextStep")
    .choose(
      tx.when(({ context }) => context.includeExtra).to("extra"),
      tx.otherwise().to("review")
    ),
  tx.any().on("requestClose").to("confirmExit"),
  tx.any().toTerminate()
);
```

Runtime remains first-match-wins.

## Metadata

- Define optional per-step `meta` on step definitions.
- Read runtime metadata from `snapshot.stepMeta`.
- Update via `machine.updateStepMetadata(stepId, updater)`.

## Observability Events

Use `subscribeEvent` for typed telemetry (`subscribe` stays snapshot-reactive only).

Minimum union includes:

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

## Removed

- top-level `timeline` and `index` snapshot fields
- `HISTORY_TARGET`
- `trimHistory()` / `clearHistory()`
- history overflow options
