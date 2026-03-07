# @rxova/journey-devtools-bridge

Bridge that connects Journey machines to the browser devtools extension.

## Install

```bash
pnpm add @rxova/journey-devtools-bridge
yarn add @rxova/journey-devtools-bridge
npm i @rxova/journey-devtools-bridge
bun add @rxova/journey-devtools-bridge
```

The bridge can run in Bun-based browser apps; explicit `enabled: true` remains the safest option when your bundler does not expose a dev/prod env signal.

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

- Defaults use `import.meta.env.DEV` / `import.meta.env.PROD` when available, otherwise `process.env.NODE_ENV`.
- Enabled by default in non-production browser runtimes.
- Disabled in production unless `enabled: true`.
- Commands disabled in production unless `commandsEnabled: true`.
- If neither env source is available, bridge and commands default to disabled unless explicitly enabled.
