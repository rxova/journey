# @rxova/journey-core

Headless runtime for non-linear journeys.

## Install

```bash
npm i @rxova/journey-core
```

## What You Get

- Deterministic transition matching (first match wins).
- Timeline + pointer navigation model.
- Built-in `goToNextStep()`, `terminateJourney()`, `completeJourney()`, `goToPreviousStep()`, and `goToLastVisitedStep()`.
- Typed observability stream via `subscribeEvent`.
- Step metadata updates via `updateStepMetadata`.
- Optional persistence helpers.

## Quickstart

```ts
import { createJourneyMachine } from "@rxova/journey-core";

type StepId = "start" | "review";
type Event = "goToNextStep" | "completeJourney" | "back";
type Ctx = { name: string };

const journey = {
  initial: "start",
  context: { name: "" },
  steps: {
    start: { meta: { label: "Start" } },
    review: { meta: { label: "Review" } }
  },
  transitions: [
    { from: "start", event: "goToNextStep", to: "review" },
    { from: "review", event: "completeJourney" }
  ]
};

const machine = createJourneyMachine<Ctx, StepId, Event>(journey);
await machine.goToNextStep();
await machine.goToPreviousStep();
await machine.completeJourney();

const snapshot = machine.getSnapshot();
console.log(snapshot.history.timeline, snapshot.history.index, snapshot.currentStepId);
```

## Transition Ergonomics

```ts
import { createTransitions, tx } from "@rxova/journey-core";

const transitions = createTransitions(
  tx.from("start").on("goToNextStep").to("review"),
  tx.from("review").toComplete()
);
```
