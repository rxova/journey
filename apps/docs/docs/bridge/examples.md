---
id: examples
title: Devtools Examples
sidebar_label: Examples
---

## Attach Bridge to Core Machine

```ts
import { createJourneyMachine } from "@rxova/journey-core";
import { attachJourneyDevtools } from "@rxova/journey-devtools-bridge";

const journeyMachine = createJourneyMachine(journey);
const detach = attachJourneyDevtools(journeyMachine, {
  machineId: "checkout",
  label: "Checkout Journey",
  enabled: true
});
journeyMachine.startJourney();
```

## Attach Bridge to React Flow

When using bindings, attach once to the shared machine (outside or before React mount).

## Command Examples

```ts
{ type: "startJourney" }
{ type: "goToNextStep" }
{ type: "goToStepById", stepId: "review" }
{ type: "goToPreviousStep", steps: 2 }
{ type: "goToLastVisitedStep" }
{ type: "send", event: { type: "custom", payload: { source: "panel" } } }
{ type: "resetJourney" }
{ type: "clearStepError", stepId: "review" }
```

## Snapshot Fields Used by Panel

- `currentStepId`, `history.timeline`, `history.index`
- `visited`, `context`
- `status`, `async`
