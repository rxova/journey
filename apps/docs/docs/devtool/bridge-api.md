---
title: Bridge API
sidebar_position: 3
---

## `attachJourneyDevtools(machine, options?)`

Attaches a machine to the devtools extension stream.

```ts
import { attachJourneyDevtools } from "@rxova/journey-devtools-bridge";

const detach = attachJourneyDevtools(machine, {
  label: "Checkout Flow",
  enabled: true,
  commandsEnabled: true
});
```

## Command Support

- `goToNextStep`, `terminateMachine`, `completeJourney`, `resetMachine`
- `goToStepById`
- `goToPreviousStep`
- `goToLastVisitedStep`
- `updateStepMetadata`
- `send` (custom event)
- `clearStepError`

## Snapshot Shape

Bridge serializes:

- `currentStepId`, `history.timeline`, `history.index`
- `context`, `visited`, `stepMeta`
- `status`, `async`
