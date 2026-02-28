---
title: Quickstart
sidebar_position: 2
---

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

Navigation helpers:

- `api.goToPreviousStep(steps?)`
- `api.goToLastVisitedStep()`
- `api.send({ type: "goToStepById", stepId: "review" })`
