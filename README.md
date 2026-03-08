# Rxova Journey

<p>
  <a href="https://github.com/rxova/journey/actions/workflows/ci.yml">
    <img src="https://github.com/rxova/journey/actions/workflows/ci.yml/badge.svg?branch=main" alt="CI" />
  </a>
  <a href="https://rxova.org/">
    <img src="https://img.shields.io/badge/docs-rxova.org-0f8f6a" alt="Docs" />
  </a>
  <img src="https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
</p>

Typed journey graphs for non-linear product flows.

This release introduces timeline-pointer navigation, typed React bindings, transition builder helpers, metadata updates, and richer devtools controls.

`[DOCS](https://rxova.org/) | [CORE](https://rxova.org/docs/core/getting-started) | [REACT](https://rxova.org/docs/react/quickstart) | [DEVTOOL](https://rxova.org/docs/devtool/overview) | [BRIDGE API](https://rxova.org/docs/devtool/bridge-api)`

## Packages

- `@rxova/journey-core`: framework-agnostic runtime.
- `@rxova/journey-react`: typed bindings factory for React.
- `@rxova/journey-devtools-bridge`: browser bridge for the devtools extension.

## Install

```bash
npm i @rxova/journey-core @rxova/journey-react
```

## Quickstart (React, bindings-first)

```tsx
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

const App = () => {
  const Provider = bindings.Provider;
  const StepRenderer = bindings.StepRenderer;

  return (
    <Provider>
      <StepRenderer />
    </Provider>
  );
};
```

## Quickstart (Core)

```ts
import { createJourneyMachine } from "@rxova/journey-core";

type StepId = "start" | "review";
type Event = "goToNextStep" | "completeJourney" | "back";
type Ctx = { accepted: boolean };

const journey = {
  initial: "start",
  context: { accepted: false },
  steps: { start: {}, review: {} },
  transitions: [
    { from: "start", event: "goToNextStep", to: "review" },
    { from: "review", event: "completeJourney" }
  ]
};

const machine = createJourneyMachine<Ctx, StepId, Event>(journey);
const result = await machine.send({ type: "goToNextStep" });
if (result.error) {
  console.error(result.error);
}
await machine.goToPreviousStep();
```

Async guards and effects can set `timeoutMs` per transition; timeouts resolve the send with `transitioned: false` plus `error` instead of hanging indefinitely.

## Optional Devtools Bridge

```ts
import { attachJourneyDevtools } from "@rxova/journey-devtools-bridge";

const detach = attachJourneyDevtools(machine, { label: "Checkout Flow" });
```
