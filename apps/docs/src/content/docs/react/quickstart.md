---
title: "Quickstart"
---

This quickstart shows the React wiring.

Runtime semantics such as history, observability, persistence, and async behavior still come from Core: [Core Overview](../core/overview.md) and [Core API](../core/api/overview.md).

Type modeling also comes from Core: [Core TypeScript](../core/typescript.md).

If you want to understand how event sending, queueing, and navigation commits work under the hood, read [Core
Machine Architecture](../core/architecture.md).

## 1. Create The Journey Once

For a single app-wide flow in a **client app**, create the journey once at module scope (shown below).
For per-instance UI (cards, modals) or **any server-rendered / RSC app**, own it inside the component
with [`useJourney`](#request-scoped-ownership) instead — a module singleton would be shared across
requests. See [Runtime ownership](/docs/react/overview#runtime-ownership) for the full decision guide.

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
    review: {}
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

For server-rendered or request-scoped UI (Next.js App Router, RSC, Remix, …), own the runtime inside a
`"use client"` component with `useJourney` — a module-level `createJourney(...)` would be shared across
every request. `useJourney` builds the runtime once, keeps it stable across StrictMode, and disposes it
on unmount:

```tsx
"use client";

import { createJourney, useJourney } from "@rxova/journey-react";

export function CheckoutFlow({ customerId }: { customerId: string }) {
  const checkout = useJourney(() =>
    createJourney({
      ...definition,
      context: { ...definition.context, customerId }
    })
  );

  return (
    <checkout.JourneyProvider views={views}>
      <checkout.StepRenderer />
    </checkout.JourneyProvider>
  );
}
```

This creates one isolated runtime per mounted boundary. To reset the journey when `customerId` changes,
remount with a `key`:

```tsx
<CheckoutFlow key={customerId} customerId={customerId} />
```

## Multiple Independent Instances

Multiple isolated flows come from multiple runtimes, not from repeating the same provider. `useJourney`
owns one per mount:

```tsx
const SignupCard = () => {
  const signup = useJourney(() => createJourney(definition));

  return (
    <signup.JourneyProvider views={views}>
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

Each `<SignupCard />` gets its own runtime and disposes it on unmount.

## Where To Go Next

- Hook surface and provider behavior: [Provider and Hooks API](./provider-and-hooks.md)
- React usage patterns: [React Patterns](./patterns.md)
- Async UI states in React: [Async UI](./async-ui.md)
- Runtime semantics: [Core API](../core/api/overview.md)
- Compatibility promises: [Stability Contract](../core/stability.md)
