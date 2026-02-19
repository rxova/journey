# @rxova/journey-react

Typed React bindings for Rxova Journey.

## Install

```bash
npm i @rxova/journey-react
```

## API Style

`@rxova/journey-react` is bindings-first:

- `createJourneyBindings(journey)` returns a typed bundle:
- `Provider`
- `StepRenderer`
- `useJourneyApi`, `useJourneySnapshot`, `useJourneyMachine`

No per-hook generic arguments are needed at callsites.

## Quickstart

```tsx
import React from "react";
import { createJourneyBindings, type JourneyReactDefinition } from "@rxova/journey-react";

type StepId = "start" | "review";
type Ctx = { name: string };

let bindings: ReturnType<typeof createJourneyBindings<Ctx, StepId>>;

const Start = () => {
  const api = bindings.useJourneyApi();
  return <button onClick={() => void api.goToNextStep()}>Next</button>;
};

const Review = () => {
  const api = bindings.useJourneyApi();
  return <button onClick={() => void api.completeJourney()}>Submit</button>;
};

const journey: JourneyReactDefinition<Ctx, StepId> = {
  initial: "start",
  context: { name: "" },
  steps: {
    start: { component: Start },
    review: { component: Review }
  },
  transitions: [
    { from: "start", event: "goToNextStep", to: "review" },
    { from: "review", event: "completeJourney" }
  ]
};

bindings = createJourneyBindings(journey);

export const App = () => {
  const Provider = bindings.Provider;
  const StepRenderer = bindings.StepRenderer;

  return (
    <Provider>
      <StepRenderer />
    </Provider>
  );
};
```

## Journey API Helpers

From `bindings.useJourneyApi()`:

- `goToNextStep`
- `terminateJourney`
- `completeJourney`
- `send`
- `goToPreviousStep(steps?)`
- `goToLastVisitedStep()`
- `updateContext`
- `updateStepMetadata`
- `clearStepError`, `resetJourney`

Imperative jump is available through `send`:

```ts
await api.send({ type: "goToStepById", stepId: "review" });
```
