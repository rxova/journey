---
title: Quickstart
sidebar_position: 2
---

This quickstart shows the React wiring.

Runtime semantics (history, observability, persistence, async behavior) come from Core: [Core Overview](/docs/core/overview) and [Core API](/docs/core/api).

Type modeling comes from Core too: [Core TypeScript](/docs/core/typescript).

## 1) Create Typed Bindings

```tsx
// journey-bindings.ts
import {
  createJourneyBindings,
  createTransitions,
  tx,
  type JourneyReactDefinition
} from "@rxova/journey-react";
import { Start, Review } from "./steps";

type StepId = "start" | "review";
type Ctx = { name: string };

export let bindings: ReturnType<typeof createJourneyBindings<Ctx, StepId>>;

const journey: JourneyReactDefinition<Ctx, StepId> = {
  initial: "start",
  context: { name: "" },
  steps: {
    start: { component: Start },
    review: { component: Review }
  },
  transitions: createTransitions(
    tx.from("start").on("goToNextStep").to("review"),
    tx.from("review").toComplete()
  )
};

bindings = createJourneyBindings(journey);
```

## 2) Build Step Components

```tsx
// steps.tsx
import { bindings } from "./journey-bindings";

export const Start = () => {
  const api = bindings.useJourneyApi();
  return <button onClick={() => void api.goToNextStep()}>Next</button>;
};

export const Review = () => {
  const api = bindings.useJourneyApi();
  return <button onClick={() => void api.completeJourney()}>Submit</button>;
};
```

## 3) Mount Provider + StepRenderer

```tsx
// App.tsx
import { bindings } from "./journey-bindings";

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

## 4) Use Navigation Helpers

```tsx
const api = bindings.useJourneyApi();

await api.goToPreviousStep(1);
await api.goToLastVisitedStep();
await api.send({ type: "goToStepById", stepId: "review" });
```

`api` is journey-typed automatically from your bindings, so event names and payload shapes are checked at compile time.

## Where To Go Next

- Hook surface and Provider behavior: [Provider and Hooks API](/docs/react/provider-and-hooks)
- React usage patterns: [React Patterns](/docs/react/patterns)
- Async UI states in React: [Async UI](/docs/react/async-ui)
- Runtime semantics (source of truth): [Core API](/docs/core/api)
