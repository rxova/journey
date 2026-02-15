# Rxova Journey

<p>
  <a href="https://github.com/rxova/journey/actions/workflows/ci.yml">
    <img src="https://github.com/rxova/journey/actions/workflows/ci.yml/badge.svg?branch=main" alt="CI" />
  </a>
  <img src="https://img.shields.io/badge/TypeScript-strict-blue" alt="TypeScript" />
  <img src="https://img.shields.io/badge/coverage-100%25-brightgreen" alt="Coverage" />
</p>

<p align="center">
  <img src="./apps/docs/static/img/rxova-logo-256.png" alt="Rxova logo" width="180" />
</p>

Declarative, typed journey graphs for non-linear product flows.

- Docs: https://rxova.org/
- Core docs: https://rxova.org/docs/core/getting-started
- React docs: https://rxova.org/docs/react/quickstart
- Core package: https://www.npmjs.com/package/@rxova/journey-core
- React package: https://www.npmjs.com/package/@rxova/journey-react

## Install

```bash
# headless runtime
npm i @rxova/journey-core

# React bindings (includes core)
npm i @rxova/journey-react
```

## Quickstart (Core)

```ts
import { createJourneyMachine, JOURNEY_TERMINAL } from "@rxova/journey-core";

type StepId = "start" | "review";
type Event = "next" | "submit";
type Ctx = { accepted: boolean };

const journey = {
  initial: "start",
  context: { accepted: false },
  steps: { start: {}, review: {} },
  transitions: [
    { from: "start", event: "next", to: "review" },
    { from: "review", event: "submit", to: JOURNEY_TERMINAL.COMPLETE }
  ]
};

const machine = createJourneyMachine<Ctx, StepId, Event>(journey);
await machine.send({ type: "next" });
```

## Quickstart (React)

```tsx
import {
  JourneyProvider,
  JourneyStepRenderer,
  useJourney,
  JOURNEY_TERMINAL,
  type JourneyReactDefinition
} from "@rxova/journey-react";

type StepId = "start" | "review";
type Ctx = { name: string };

const Start = () => {
  const { api } = useJourney<Ctx, StepId>();
  return <button onClick={() => void api.next()}>Next</button>;
};

const Review = () => {
  const { api } = useJourney<Ctx, StepId>();
  return <button onClick={() => void api.submit()}>Submit</button>;
};

const journey: JourneyReactDefinition<Ctx, StepId> = {
  initial: "start",
  context: { name: "" },
  steps: {
    start: { component: Start },
    review: { component: Review }
  },
  transitions: [
    { from: "start", event: "next", to: "review" },
    { from: "review", event: "submit", to: JOURNEY_TERMINAL.COMPLETE }
  ]
};

export const App = () => (
  <JourneyProvider journey={journey}>
    <JourneyStepRenderer<Ctx, StepId> />
  </JourneyProvider>
);
```

## Learn More

- Core architecture/design: https://rxova.org/docs/core/architecture
- Core API: https://rxova.org/docs/core/api
- Core history/persistence/async: https://rxova.org/docs/core/history
- React provider/hooks: https://rxova.org/docs/react/provider-and-hooks
- React examples: https://rxova.org/docs/react/examples
