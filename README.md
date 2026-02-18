# Rxova Journey

<p>
  <a href="https://github.com/rxova/journey/actions/workflows/ci.yml">
    <img src="https://github.com/rxova/journey/actions/workflows/ci.yml/badge.svg?branch=main" alt="CI" />
  </a>
  <a href="https://rxova.org/">
    <img src="https://img.shields.io/badge/docs-rxova.org-0f8f6a" alt="Docs" />
  </a>
  <img src="https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <a href="https://www.npmjs.com/package/@rxova/journey-core">
    <img src="https://img.shields.io/npm/v/@rxova/journey-core" alt="Core npm version" />
  </a>
  <a href="https://www.npmjs.com/package/@rxova/journey-react">
    <img src="https://img.shields.io/npm/v/@rxova/journey-react" alt="React npm version" />
  </a>
  <a href="https://www.npmjs.com/package/@rxova/journey-devtools-bridge">
    <img src="https://img.shields.io/npm/v/@rxova/journey-devtools-bridge" alt="Bridge npm version" />
  </a>
</p>

<p align="center">
  <img src="./apps/docs/static/img/rxova-logo-256.png" alt="Rxova logo" width="180" />
</p>

Typed journey graphs for non-linear product flows in web apps.

Rxova Journey gives you one place to define step flow logic (branching, history, async guards/effects), then reuse that logic in React or headless runtimes.

`[DOCS](https://rxova.org/) | [CORE](https://rxova.org/docs/core/getting-started) | [REACT](https://rxova.org/docs/react/quickstart) | [DEVTOOL](https://rxova.org/docs/devtool/overview) | [BRIDGE API](https://rxova.org/docs/devtool/bridge-api)`

## Choose Your Package

- `@rxova/journey-core`: headless state machine runtime (framework-agnostic).
- `@rxova/journey-react`: React provider/hooks/step renderer on top of core.
- `@rxova/journey-devtools-bridge`: optional bridge for browser DevTools integration.

## Install

```bash
# headless runtime
npm i @rxova/journey-core

# React bindings (includes core)
npm i @rxova/journey-react
```

## Quickstart (React, most common)

Use this when your journey renders UI.

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

## Quickstart (Core, headless)

Use this when you want journey logic without React UI rendering.

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

## Optional DevTools Bridge

```ts
import { attachJourneyDevtools } from "@rxova/journey-devtools-bridge";

const detach = attachJourneyDevtools(machine, { label: "Checkout Flow" });
```
