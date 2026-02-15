# @rxova/journey-react

<p>
  <a href="https://github.com/rxova/journey/actions/workflows/ci.yml">
    <img src="https://github.com/rxova/journey/actions/workflows/ci.yml/badge.svg?branch=main" alt="CI" />
  </a>
  <img src="https://img.shields.io/badge/TypeScript-strict-blue" alt="TypeScript" />
  <img src="https://img.shields.io/badge/coverage-100%25-brightgreen" alt="Coverage" />
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

- Docs: https://rxova.org/docs/react/quickstart
- Provider/Hooks: https://rxova.org/docs/react/provider-and-hooks
- Patterns: https://rxova.org/docs/react/patterns
- Async UX: https://rxova.org/docs/react/async-ui
- Examples: https://rxova.org/docs/react/examples

## Install

```bash
npm i @rxova/journey-react
```

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
