---
id: getting-started
title: Getting Started
sidebar_label: Getting Started
---

## Install

```bash
pnpm add @rxova/journey-core
```

## Define a Journey

```ts
import {
  createJourneyMachine,
  createTransitions,
  tx,
  type JourneyDefinition
} from "@rxova/journey-core";

type StepId = "start" | "details" | "review" | "confirmExit";
type Event = "goToNextStep" | "back" | "requestClose" | "terminateJourney" | "completeJourney";
type Context = { dirty: boolean };

const journey: JourneyDefinition<Context, StepId, Event> = {
  initial: "start",
  context: { dirty: false },
  steps: {
    start: {},
    details: {},
    review: {},
    confirmExit: {}
  },
  transitions: createTransitions(
    tx.from("start").on("goToNextStep").to("details"),
    tx.from("details").on("goToNextStep").to("review"),
    tx
      .any()
      .on("requestClose")
      .to("confirmExit", {
        when: ({ context }) => context.dirty
      }),
    tx.any().toTerminate(),
    tx.from("review").toComplete()
  )
};
```

## Create Machine

```ts
const machine = createJourneyMachine(journey);
```

## Drive It

```ts
await machine.send({ type: "goToNextStep" });
await machine.send({ type: "goToNextStep" });
await machine.send({ type: "back" }); // explicit transition or fallback previous-step
await machine.goToPreviousStep(2);
await machine.goToLastVisitedStep();
```

## Read Snapshot

```ts
const snapshot = machine.getSnapshot();

console.log(snapshot.currentStepId);
console.log(snapshot.history.timeline, snapshot.history.index);
console.log(snapshot.visited);
console.log(snapshot.status);
```

## Subscribe

```ts
const unsubscribeSnapshot = machine.subscribe(() => {
  console.log("snapshot changed", machine.getSnapshot());
});

const unsubscribeEvents = machine.subscribeEvent((event) => {
  console.log("telemetry event", event.type, event);
});
```

## Persistence

```ts
const persistedMachine = createJourneyMachine(journey, {
  persistence: {
    key: "checkout-journey",
    version: 2
  }
});
```

Persisted shape includes `history.timeline`, `history.index`, `currentStepId`, `context`, `visited`, `stepMeta`, and `status`.
