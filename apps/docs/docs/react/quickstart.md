---
title: Quickstart
sidebar_position: 2
---

Install React bindings:

```bash
npm i @rxova/journey-react
```

Minimal example:

```tsx
import React from "react";
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

  return (
    <button
      onClick={() => {
        api.updateContext((ctx) => ({ ...ctx, name: "Ada" }));
        void api.next();
      }}
    >
      Continue
    </button>
  );
};

const Review = () => {
  const { snapshot, api } = useJourney<Ctx, StepId>();

  return (
    <div>
      <p>Hello {snapshot.context.name}</p>
      <button onClick={() => void api.submit()}>Finish</button>
    </div>
  );
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

## Optional Provider Configuration

```tsx
<JourneyProvider
  journey={journey}
  persistence={{ key: "signup-journey", version: 1 }}
  history={{ maxHistory: 25 }}
>
  <JourneyStepRenderer />
</JourneyProvider>
```

## Practical Notes

- Keep `journey` reference stable (for example with `useMemo`) unless you intentionally want to recreate/reset.
- Use Core docs for transition semantics, history behavior, persistence migration, and async phases.
