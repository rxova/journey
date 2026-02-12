# @rxova/journey-core

The core Journey state machine for non-React environments. Use this package if you want the smallest, framework-agnostic runtime.

## Install

```bash
pnpm add @rxova/journey-core
npm install @rxova/journey-core
yarn add @rxova/journey-core
```

## Basic usage

```ts
import {
  createJourneyMachine,
  JOURNEY_TERMINAL,
  type JourneyDefinition
} from "@rxova/journey-core";

type StepId = "one" | "two" | "three";
type Event = "next" | "submit";
type Ctx = { name: string };

const journey: JourneyDefinition<Ctx, StepId, Event> = {
  initial: "one",
  context: { name: "" },
  steps: {
    one: {},
    two: {},
    three: {}
  },
  transitions: [
    { from: "one", event: "next", to: "two" },
    { from: "two", event: "next", to: "three" },
    { from: "three", event: "submit", to: JOURNEY_TERMINAL.COMPLETE }
  ]
};

const machine = createJourneyMachine<Ctx, StepId, Event>(journey);
```

## Links

- Docs: ../../docs/GETTING_STARTED.md
- API: ../../docs/API.md
- React bindings: ../react
