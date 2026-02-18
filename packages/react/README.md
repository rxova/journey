# @rxova/journey-react

<p>
  <a href="https://www.npmjs.com/package/@rxova/journey-react">
    <img src="https://img.shields.io/badge/npm-%40rxova%2Fjourney--react-CB3837?logo=npm&logoColor=white" alt="npm package @rxova/journey-react" />
  </a>
  <a href="https://rxova.org/docs/react/quickstart">
    <img src="https://img.shields.io/badge/docs-react-0f8f6a" alt="React docs" />
  </a>
  <a href="https://github.com/rxova/journey/actions/workflows/ci.yml">
    <img src="https://github.com/rxova/journey/actions/workflows/ci.yml/badge.svg?branch=main" alt="CI" />
  </a>
  <img src="https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/coverage%20(react)-100%25-brightgreen" alt="React coverage" />
  <a href="https://www.npmjs.com/package/@rxova/journey-react">
    <img src="https://img.shields.io/npm/v/@rxova/journey-react" alt="npm version" />
  </a>
  <a href="https://www.npmjs.com/package/@rxova/journey-react">
    <img src="https://img.shields.io/npm/dm/@rxova/journey-react" alt="npm downloads" />
  </a>
  <a href="https://bundlephobia.com/package/@rxova/journey-react">
    <img src="https://img.shields.io/bundlephobia/minzip/%40rxova%2Fjourney-react" alt="Bundlephobia" />
  </a>
</p>

React bindings for Journey (`JourneyProvider`, hooks, renderer).

Use this package when you want Journey flow logic directly inside React components.

`[OVERVIEW](https://rxova.org/docs/react/overview) | [QUICKSTART](https://rxova.org/docs/react/quickstart) | [PROVIDER + HOOKS](https://rxova.org/docs/react/provider-and-hooks) | [PATTERNS](https://rxova.org/docs/react/patterns) | [ASYNC UI](https://rxova.org/docs/react/async-ui) | [EXAMPLES](https://rxova.org/docs/react/examples) | [DEVTOOL](https://rxova.org/docs/devtool/overview)`

## Install

```bash
npm i @rxova/journey-react
```

## What You Get

- `JourneyProvider` to scope one flow instance.
- `useJourney()` hooks to read state and send actions.
- `JourneyStepRenderer` to render the active step component.
- Full access to the underlying machine when needed.

## Quickstart

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

// 1) Step components call the Journey API.
const Start = () => {
  const { api } = useJourney<Ctx, StepId>();
  return <button onClick={() => void api.next()}>Next</button>;
};

const Review = () => {
  const { api } = useJourney<Ctx, StepId>();
  return <button onClick={() => void api.submit()}>Submit</button>;
};

// 2) Journey definition stays declarative and typed.
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

// 3) Provider + renderer handle active-step rendering.
export const App = () => (
  <JourneyProvider journey={journey}>
    <JourneyStepRenderer<Ctx, StepId> />
  </JourneyProvider>
);
```

## Machine Access

```tsx
import { useJourneyMachine } from "@rxova/journey-react";

const DebugBridge = () => {
  // Useful for diagnostics, adapters, or custom dev tooling.
  const machine = useJourneyMachine();
  return <pre>{machine.getSnapshot().current}</pre>;
};
```

## Coverage Notes

Coverage badge is package-specific (`packages/react/test` against `packages/react/src`), not monorepo-wide.
