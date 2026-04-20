---
id: getting-started
title: Quickstart
sidebar_label: Quickstart
---

import Tabs from "@theme/Tabs";
import TabItem from "@theme/TabItem";

## Install

<Tabs groupId="package-managers" defaultValue="pnpm">
  <TabItem value="pnpm" label="pnpm">

```bash
pnpm add @rxova/journey-core
```

  </TabItem>
  <TabItem value="yarn" label="yarn">

```bash
yarn add @rxova/journey-core
```

  </TabItem>
  <TabItem value="npm" label="npm">

```bash
npm install @rxova/journey-core
```

  </TabItem>
  <TabItem value="bun" label="bun">

```bash
bun add @rxova/journey-core
```

  </TabItem>
</Tabs>

`@rxova/journey-core` works in any standard ESM runtime and does not require a UI framework.

## Define a Journey

Journey supports three ways to define transitions: **linear**, **graph**, and **headless**. All three share the same runtime, snapshot shape, and navigation API. Pick the one that fits your flow.

Reserved step ids: `*`, `global`, `COMPLETE`, and `TERMINATED`. They are used by the runtime and cannot be used as actual step names.

### Linear

Use the array shorthand when steps follow a fixed sequence. Each entry is a step id or an object with synchronous context updates and timeouts.

```ts
import { createJourneyMachine, type JourneyDefinition } from "@rxova/journey-core";

type StepId = "account" | "details" | "payment" | "review";
type Context = { email: string; completedSteps: number };
type StepMeta = { label: string };

const checkout: JourneyDefinition<Context, StepId, Record<never, never>, StepMeta> = {
  initial: "account",
  context: { email: "", completedSteps: 0 },
  steps: {
    account: { meta: { label: "Account" } },
    details: { meta: { label: "Details" } },
    payment: { meta: { label: "Payment" } },
    review: { meta: { label: "Review" } }
  },
  transitions: [
    "account",
    {
      step: "details",
      timeoutMs: 5000,
      updateContext: ({ context }) => ({
        ...context,
        completedSteps: context.completedSteps + 1
      })
    },
    "payment",
    "review"
  ]
};

const machine = createJourneyMachine(checkout);
machine.startJourney();
```

### Graph

Use step-keyed transitions when your flow has branching, conditional routing, retries, or custom events.

```ts
import { createJourneyMachine, type JourneyDefinition } from "@rxova/journey-core";

type StepId = "login" | "admin" | "dashboard" | "blocked";
type Context = { role: "admin" | "user" | null };

const auth: JourneyDefinition<Context, StepId> = {
  initial: "login",
  context: { role: null },
  steps: {
    login: {},
    admin: {},
    dashboard: {},
    blocked: {}
  },
  transitions: {
    login: {
      goToNextStep: [
        { to: "admin", when: ({ context }) => context.role === "admin" },
        { to: "dashboard", when: ({ context }) => context.role === "user" },
        { to: "blocked" }
      ]
    },
    admin: {
      goToNextStep: [{ to: "dashboard" }]
    },
    blocked: {
      goToNextStep: [{ to: "login" }]
    }
  }
};

const machine = createJourneyMachine(auth);
machine.startJourney();
```

### Headless

Omit `transitions` entirely and navigate with `goToStepById`. Useful for custom renderers, non-React environments, or flows where the driver decides the path at runtime.

```ts
import { createJourneyMachine, type JourneyDefinition } from "@rxova/journey-core";

type StepId = "intro" | "configure" | "confirm";

const flow: JourneyDefinition<Record<string, never>, StepId> = {
  initial: "intro",
  context: {},
  steps: { intro: {}, configure: {}, confirm: {} }
};

const machine = createJourneyMachine(flow);
machine.startJourney();

await machine.goToStepById("configure");
await machine.goToStepById("confirm");
```

In headless mode, `goToStepById(...)` is the forward-navigation primitive. `goToNextStep()` and custom events stay no-op until you define transitions.

## Drive It

All three modes share the same runtime API, but not every command is meaningful in every mode:

```ts
await machine.send({ type: "goToNextStep" });
await machine.goToPreviousStep();
await machine.goToLastVisitedStep();
await machine.goToStepById("review");

await machine.send({ type: "completeJourney" });
await machine.send({ type: "terminateJourney" });
```

- Use `goToNextStep` in linear and graph flows.
- Use `goToStepById` in headless flows.
- `goToPreviousStep`, `goToLastVisitedStep`, `completeJourney`, and `terminateJourney` work in all modes.

After `dispose()`, send-style APIs resolve with `transitioned: false` and `error: JourneyDisposedError`. Sync control APIs such as `startJourney()` and `updateContext()` stay no-op and emit a development warning.

Convenience helpers are also available:

```ts
await machine.goToNextStep();
await machine.goToPreviousStep(2); // go back 2 steps
await machine.completeJourney();
await machine.terminateJourney();
```

## Read the Snapshot

```ts
const snapshot = machine.getSnapshot();

console.log(snapshot.currentStepId);
console.log(snapshot.history.timeline, snapshot.history.index);
console.log(snapshot.context);
console.log(snapshot.visited);
console.log(snapshot.async.byStep[snapshot.currentStepId]);
console.log(snapshot.status);
```

## Subscribe

```ts
const unsubscribeSnapshot = machine.subscribe(() => {
  console.log("snapshot changed", machine.getSnapshot());
});

const unsubscribeCurrentStep = machine.subscribeSelector(
  (snapshot) => snapshot.currentStepId,
  (next, previous) => {
    console.log("step changed", previous, "->", next);
  }
);

const unsubscribeEvents = machine.subscribeEvent((event) => {
  console.log("lifecycle event", event.type, event);
});
```

## Persistence

```ts
import { createPersistencePlugin } from "@rxova/journey-core/persistence";

const machine = createJourneyMachine(checkout, {
  plugins: [
    createPersistencePlugin({
      key: "checkout-journey",
      version: 2,
      blockList: ["payment.cardNumber", "payment.cvv"]
    })
  ]
});
```

Persisted shape includes `history.timeline`, `history.index`, `currentStepId`, `context`, `visited`, and `status`. Context can be filtered with `allowList` and `blockList` when some fields should never be stored.

## What to Read Next

- [Overview](/docs/core/overview) for the product-level picture
- [Usage](/docs/core/usage) for a deeper look at linear, graph, and headless modes
- [TypeScript](/docs/core/typescript) for type modeling patterns
- [Plugins](/docs/core/plugins/overview) for persistence and execution-path extensions
