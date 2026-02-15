# @rxova/journey-core

Headless Journey runtime for non-React environments.

- Docs: https://rxova.org/docs/core/getting-started
- API: https://rxova.org/docs/core/api
- History: https://rxova.org/docs/core/history
- Persistence: https://rxova.org/docs/core/persistence
- Examples: https://rxova.org/docs/core/examples

## Install

```bash
npm i @rxova/journey-core
```

## Quickstart

```ts
import { createJourneyMachine, JOURNEY_TERMINAL } from "@rxova/journey-core";

type StepId = "start" | "review";
type Event = "next" | "submit";

type Ctx = { name: string };

const journey = {
  initial: "start",
  context: { name: "" },
  steps: { start: {}, review: {} },
  transitions: [
    { from: "start", event: "next", to: "review" },
    { from: "review", event: "submit", to: JOURNEY_TERMINAL.COMPLETE }
  ]
};

const machine = createJourneyMachine<Ctx, StepId, Event>(journey);
await machine.send({ type: "next" });
```
