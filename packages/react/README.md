# @rxova/journey-react

Typed React bindings for Rxova Journey.

## Install

```bash
pnpm add @rxova/journey-react
yarn add @rxova/journey-react
npm i @rxova/journey-react
bun add @rxova/journey-react
```

Works in Bun-based SPAs as long as your app runtime supports React 18+.

## API Style

`@rxova/journey-react` is bindings-first:

- `createJourneyBindings(journey)` returns a typed bundle that contains:
  - `Provider`
  - `StepRenderer`
  - `useJourneyApi`
  - `useJourneyEvent`
  - `useJourneySelector`
  - `useJourneySnapshot`
  - `useJourneyMachine`

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

## Split Files Pattern (Hooks In Steps)

If step components live in separate files and call Journey hooks, export bindings as `let`:

```tsx
// journey-bindings.ts
import { createJourneyBindings, type JourneyReactDefinition } from "@rxova/journey-react";
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
  transitions: [
    { from: "start", event: "goToNextStep", to: "review" },
    { from: "review", event: "completeJourney" }
  ]
};

bindings = createJourneyBindings(journey);
```

## Hooks

- `useJourneySnapshot()` subscribes to the machine and rerenders on changes.
- `useJourneyEvent(listener)` subscribes to typed lifecycle events.
- `useJourneySelector(selector, equalityFn?)` subscribes to a selected slice and rerenders only when that selected value changes.
- `useJourneyApi()` returns typed commands.
- `useJourneyMachine()` returns the underlying core machine instance.

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

`updateContext()` is immediate, but it follows core async timing rules: it does not retroactively change a transition already in `evaluating-when` or `running-effect`, and a running effect can later commit over that update. If the change must affect the current transition, apply it before `send(...)` or await the transition first.

## Provider Behavior

- `<Provider />` creates an internal core machine from the bound journey.
- `<Provider journey={...} />` lets you pass a different journey definition at runtime.
- Internal machine is preserved across `journey` and `persistence` prop changes by default.
- Set `resetOnJourneyChange` to rebuild internal machine when `journey` identity changes.
- Set `resetOnPersistenceChange` to rebuild internal machine when `persistence` identity changes.
- `<Provider machine={externalMachine} />` uses your machine directly.
- `persistence` applies only when Provider owns the internal machine.
- `onComplete(event)` wraps `machine.subscribeComplete(...)`.
- `onTerminate(event)` wraps `machine.subscribeTerminate(...)`.
- Both callback props work with internal and external machines and fire only for emitted lifecycle events.

```tsx
<bindings.Provider
  journey={dynamicJourney}
  resetOnJourneyChange
  onComplete={() => console.log("finished!")}
>
  <bindings.StepRenderer />
</bindings.Provider>
```

## Async and Error UI

Core async state is exposed via snapshot:

```tsx
const api = bindings.useJourneyApi();
const snapshot = bindings.useJourneySnapshot();

if (snapshot.async.isLoading) return <p>Working...</p>;

const currentAsync = snapshot.async.byStep[snapshot.currentStepId];
if (currentAsync.phase === "error") {
  return (
    <div>
      <p>Something failed.</p>
      <button onClick={() => api.clearStepError()}>Dismiss</button>
    </div>
  );
}
```

## Devtools Bridge

Use `useJourneyMachine()` and attach the devtools bridge from an effect:

```tsx
import React from "react";
import { attachJourneyDevtools } from "@rxova/journey-devtools-bridge";

const JourneyDevtoolsBridge = () => {
  const machine = bindings.useJourneyMachine();

  React.useEffect(() => {
    return attachJourneyDevtools(machine, { label: "Signup" });
  }, [machine]);

  return null;
};
```

## Transition Ergonomics

`@rxova/journey-react` re-exports core transition builders:

```ts
import { createTransitions, tx } from "@rxova/journey-react";

const transitions = createTransitions(
  tx.from("start").on("goToNextStep").to("review"),
  tx.from("review").toComplete()
);
```

## SSR and RSC Notes

- This package is a client entry (`"use client"`).
- In React Server Components environments, call bindings/hooks from client components.
- Server-side rendering is supported (Provider + StepRenderer render safely on the server).
