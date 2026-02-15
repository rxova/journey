---
title: Quickstart
sidebar_position: 2
---

Install React bindings:

```bash
npm i @rxova/journey-react
```

## 1. Define Types

```tsx
type StepId = "start" | "details" | "review" | "confirmExit";
type Event = "next" | "back" | "close" | "submit";
type Ctx = { name: string; dirty: boolean; includeDetails: boolean };
```

## 2. Create Step Components

```tsx
import React from "react";
import {
  HISTORY_TARGET,
  JOURNEY_TERMINAL,
  JourneyProvider,
  JourneyStepRenderer,
  useJourney,
  type JourneyReactDefinition
} from "@rxova/journey-react";

const Start = () => {
  const { api } = useJourney<Ctx, StepId, Event>();

  return (
    <button
      onClick={() => {
        api.updateContext((ctx) => ({ ...ctx, name: "Ada", dirty: true }));
        void api.next();
      }}
    >
      Continue
    </button>
  );
};

const Details = () => {
  const { api } = useJourney<Ctx, StepId, Event>();

  return <button onClick={() => void api.next()}>Continue to review</button>;
};

const Review = () => {
  const { snapshot, api } = useJourney<Ctx, StepId, Event>();

  return (
    <div>
      <p>Ready, {snapshot.context.name}?</p>
      <button onClick={() => void api.back()}>Back</button>
      <button onClick={() => void api.submit()}>Finish</button>
    </div>
  );
};

const ConfirmExit = () => <p>You have unsaved changes. Exit anyway?</p>;
```

## 3. Define Journey Graph

```tsx
const journey: JourneyReactDefinition<Ctx, StepId, Event> = {
  initial: "start",
  context: { name: "", dirty: false, includeDetails: true },
  steps: {
    start: { component: Start },
    details: { component: Details },
    review: { component: Review },
    confirmExit: { component: ConfirmExit }
  },
  transitions: [
    { from: "start", event: "next", to: "details" },
    {
      from: "details",
      event: "next",
      to: "review",
      when: ({ context }) => context.includeDetails
    },
    { from: "*", event: "back", to: HISTORY_TARGET },
    {
      from: "*",
      event: "close",
      to: "confirmExit",
      when: ({ context }) => context.dirty
    },
    {
      from: "*",
      event: "close",
      to: JOURNEY_TERMINAL.CLOSE,
      when: ({ context }) => !context.dirty
    },
    { from: "review", event: "submit", to: JOURNEY_TERMINAL.COMPLETE }
  ]
};
```

## 4. Mount Provider + Renderer

```tsx
export const App = () => (
  <JourneyProvider journey={journey}>
    <JourneyStepRenderer<Ctx, StepId, Event> />
  </JourneyProvider>
);
```

## 5. Optional Provider Configuration

```tsx
<JourneyProvider
  journey={journey}
  persistence={{ key: "signup-journey", version: 1 }}
  history={{ maxHistory: 25 }}
>
  <JourneyStepRenderer />
</JourneyProvider>
```

## 6. Next Steps

- Full hook/provider API: `/docs/react/provider-and-hooks`
- Production patterns: `/docs/react/patterns`
- Async loading/error UI: `/docs/react/async-ui`
- End-to-end examples: `/docs/react/examples`

Core semantics reference:

- `/docs/core/api`
- `/docs/core/history`
- `/docs/core/persistence`
- `/docs/core/async`
