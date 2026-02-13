# @rxova/journey-react

React bindings for Journey. This package includes the core state machine and provides hooks and provider components.

## Install

```bash
pnpm add @rxova/journey-react
npm install @rxova/journey-react
yarn add @rxova/journey-react
```

## Basic usage

```tsx
import React from "react";

import {
  JOURNEY_TERMINAL,
  type JourneyReactDefinition,
  JourneyProvider,
  JourneyStepRenderer,
  useJourney
} from "@rxova/journey-react";

type StepId = "one" | "two" | "three";
type Ctx = { name: string };

const One = () => {
  const { api } = useJourney<Ctx, StepId>();
  return <button onClick={() => api.next()}>Next</button>;
};

const Two = () => {
  const { api } = useJourney<Ctx, StepId>();
  return <button onClick={() => api.next()}>Next</button>;
};

const Three = () => {
  const { api } = useJourney<Ctx, StepId>();
  return <button onClick={() => api.submit()}>Finish</button>;
};

const journey: JourneyReactDefinition<Ctx, StepId> = {
  initial: "one",
  context: { name: "" },
  steps: {
    one: { component: One },
    two: { component: Two },
    three: { component: Three }
  },
  transitions: [
    { from: "one", event: "next", to: "two" },
    { from: "two", event: "next", to: "three" },
    { from: "three", event: "submit", to: JOURNEY_TERMINAL.COMPLETE }
  ]
};

export const Example = () => (
  <JourneyProvider journey={journey}>
    <JourneyStepRenderer<Ctx, StepId> />
  </JourneyProvider>
);
```

## Notes

- Requires React as a peer dependency (React 18.2+).

## Links

- Docs: https://rxova.org/docs/core/getting-started
- API: https://rxova.org/docs/core/api
- Recipes: https://rxova.org/docs/core/recipes
- Core package: ../core
