# @rxova/journey-devtools-bridge

Bridge that connects Journey machines to the browser devtools extension.

## Install

```bash
npm i @rxova/journey-devtools-bridge
```

## Usage

```ts
import { createJourneyMachine } from "@rxova/journey-core";
import { attachJourneyDevtools } from "@rxova/journey-devtools-bridge";

const machine = createJourneyMachine(journey);

const detach = attachJourneyDevtools(machine, {
  label: "Checkout Flow"
});
```

## Protocol Notes

Bridge command support includes:

- `goToNextStep`, `terminateMachine`, `completeJourney`, `resetMachine`
- `goToStepById`
- `goToPreviousStep`
- `goToLastVisitedStep`
- `updateStepMetadata`
- `send` (custom event)
- `clearStepError`

Snapshots include `history.timeline`, `history.index`, `currentStepId`, `visited`, `stepMeta`, `status`, and `async`.

## Runtime Defaults

- Enabled in non-production by default.
- Disabled in production unless `enabled: true`.
- Commands disabled in production unless `commandsEnabled: true`.
