---
title: "Quickstart"
---

This quickstart shows the React wiring.

Runtime semantics such as history, observability, persistence, and async behavior still come from Core: [Core Overview](../core/overview.md) and [Core API](../core/api/overview.md).

Type modeling also comes from Core: [Core TypeScript](../core/typescript.md).

If you want to understand how event sending, queueing, and navigation commits work under the hood, read [Core
Machine Architecture](../core/architecture.md).

## 1. Create The Journey Once

Prefer creating the journey at module scope. If you create it inside a component, memoize it and decide explicitly whether the provider or the component owns disposal.

The value returned from `createJourney(...)` is a `JourneyRuntime`.

```tsx
// signup-journey.tsx
import { createJourney, type JourneyViews } from "@rxova/journey-react";
import type { JourneyDefinition } from "@rxova/journey-core";
import { Start, Review } from "./steps";

type StepId = "start" | "review";
type Context = { name: string };

const definition: JourneyDefinition<Context, StepId> = {
  initial: "start",
  context: { name: "" },
  steps: {
    start: { meta: { title: "Start" } },
    review: { meta: { title: "Review" } }
  },
  transitions: {
    start: {
      goToNextStep: [{ to: "review" }]
    },
    review: {
      completeJourney: true
    }
  }
};

export const signupJourney = createJourney(definition);

export const signupViews: JourneyViews<StepId> = {
  start: Start,
  review: Review
};
```

## 2. Build Step Components

Hooks work without a provider because they close over the created machine.

```tsx
// steps.tsx
import { signupJourney } from "./signup-journey";

export const Start = () => {
  const api = signupJourney.useJourneyApi();
  return <button onClick={() => void api.goToNextStep()}>Next</button>;
};

export const Review = () => {
  const api = signupJourney.useJourneyApi();
  return <button onClick={() => void api.completeJourney()}>Submit</button>;
};
```

## 3. Mount `JourneyProvider` And `StepRenderer`

`JourneyProvider` only supplies the `views` record and lifecycle callbacks for `StepRenderer`.

```tsx
// App.tsx
import { signupJourney, signupViews } from "./signup-journey";

export const App = () => {
  const JourneyProvider = signupJourney.JourneyProvider;
  const StepRenderer = signupJourney.StepRenderer;

  return (
    <JourneyProvider views={signupViews}>
      <StepRenderer />
    </JourneyProvider>
  );
};
```

## 4. Use Navigation Helpers

```tsx
const api = signupJourney.useJourneyApi();

await api.goToPreviousStep(1);
await api.goToLastVisitedStep();
await api.goToStepById("review");
```

`api` is fully typed from your definition, so event names and payload shapes stay checked at compile time.

Guard and `updateContext` failures resolve through `result.error` instead of rejecting, so `void api.goToNextStep()` is safe from unhandled promise rejections.

## Request-Scoped Ownership

For server-rendered or request-scoped UI, create the runtime inside the owned client boundary instead of sharing one global runtime:

```tsx
"use client";

import React from "react";
import { createJourney } from "@rxova/journey-react";

export function CheckoutFlow({ customerId }: { customerId: string }) {
  const checkout = React.useMemo(
    () =>
      createJourney({
        ...definition,
        context: {
          ...definition.context,
          customerId
        }
      }),
    [customerId]
  );

  return (
    <checkout.JourneyProvider views={views} disposeOnUnmount>
      <checkout.StepRenderer />
    </checkout.JourneyProvider>
  );
}
```

This creates one runtime per mounted boundary. If a prop change should reset the journey, remount that boundary deliberately.

## Multiple Independent Instances

Multiple isolated flows come from multiple runtimes, not from repeating the same provider:

```tsx
const makeSignupJourney = createJourneyFactory(definition);

const SignupCard = () => {
  const signup = React.useMemo(() => makeSignupJourney(), []);

  return (
    <signup.JourneyProvider views={views} disposeOnUnmount>
      <signup.StepRenderer />
    </signup.JourneyProvider>
  );
};

export const ComparisonGrid = () => (
  <>
    <SignupCard />
    <SignupCard />
  </>
);
```

## Where To Go Next

- Hook surface and provider behavior: [Provider and Hooks API](./provider-and-hooks.md)
- React usage patterns: [React Patterns](./patterns.md)
- Async UI states in React: [Async UI](./async-ui.md)
- Runtime semantics: [Core API](../core/api/overview.md)
- Compatibility promises: [Stability Contract](../core/stability.md)
