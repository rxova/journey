---
id: linear
title: Linear
sidebar_label: Linear
---

# Linear

`createLinearJourney` creates a machine where steps follow a fixed sequence. `goToNextStep` advances through them in order; `goToPreviousStep` moves back. The factory derives the transition graph from the steps array automatically — no need to declare it manually.

:::info Good fit
Onboarding flows, checkout, multi-step forms, configuration wizards, any flow where "next" always means the same thing.
:::

## Define a Linear Journey

Pass an ordered array of step ids. Each entry can be a plain string or an object for richer step configuration.

```ts
import { createLinearJourney } from "@rxova/journey-core";

type StepId = "account" | "details" | "payment" | "review";
type Context = { email: string; plan: string | null };
type StepMeta = { label: string; icon: string };

const machine = createLinearJourney<Context, StepId, StepMeta>({
  context: { email: "", plan: null },
  steps: [
    { id: "account", meta: { label: "Account", icon: "user" } },
    { id: "details", meta: { label: "Details", icon: "form" } },
    { id: "payment", meta: { label: "Payment", icon: "card" } },
    { id: "review", meta: { label: "Review", icon: "check" } }
  ]
});

await machine.startJourney();
```

### String shorthand

If you don't need per-step metadata or lifecycle callbacks, use plain strings:

```ts
const machine = createLinearJourney<Context, StepId>({
  context: { email: "", plan: null },
  steps: ["account", "details", "payment", "review"]
});
```

### Step lifecycle callbacks

Use `onEnter` and `onLeave` to hook into step transitions without polluting context:

```ts
steps: [
  {
    id: "payment",
    meta: { label: "Payment", icon: "card" },
    onEnter: async ({ context }) => {
      await analytics.track("payment_viewed");
    },
    onLeave: async ({ context }) => {
      await analytics.track("payment_left");
    }
  }
];
```

## Navigation

### Sequential navigation

```ts
await machine.goToNextStep(); // advances one step
await machine.goToPreviousStep(); // goes back one step
await machine.goToPreviousStep(2); // goes back two steps
```

### Index-based navigation

`goToStepByIndex` is a `LinearJourneyMachine`-only method. It maps the index to the correct navigation primitive:

```ts
await machine.goToStepByIndex(0); // → goToPreviousStep (back to first)
await machine.goToStepByIndex(1); // → goToNextStep (next step)
await machine.goToStepByIndex(3); // → goToStepById (arbitrary forward jump)
```

:::note
`goToStepByIndex` returns `{ transitioned: false }` for out-of-bounds indices instead of throwing.
:::

### Completion

`goToNextStep` on the last step auto-completes the journey unless you set `requireExplicitCompletion: true` in the options.

```ts
await machine.completeJourney(); // explicit completion
```

## Linear-only Computed State

```ts
const computed = machine.getComputed();

if (computed.mode === "linear") {
  computed.stepCount; // total number of steps
  computed.isFirstStep; // true when on step index 0
  computed.isLastStep; // true when on the final step
  computed.stepOrder; // readonly ordered step id array
  computed.activeStepIndex; // current position in the sequence
}
```

Use these to drive progress indicators, back-button visibility, and completion gates without manual tracking.

```tsx
// Progress bar example
const { stepCount, activeStepIndex } = machine.getComputed();
const progress = ((activeStepIndex + 1) / stepCount) * 100;
```

## Step Metadata

Read per-step static data at any time:

```ts
const meta = machine.getStepMeta("payment");
console.log(meta?.label); // "Payment"
console.log(meta?.icon); // "card"
```

## Context Updates

Context updates are separate from transitions. Use `updateContext` before or after a navigation call:

```ts
await machine.updateContext((ctx) => ({ ...ctx, email: "user@example.com" }));
await machine.goToNextStep();
```

## Full Example

```ts
import { createLinearJourney } from "@rxova/journey-core";

type StepId = "intro" | "profile" | "confirm";
type Context = { name: string; agreed: boolean };

const machine = createLinearJourney<Context, StepId>({
  context: { name: "", agreed: false },
  steps: ["intro", "profile", "confirm"]
});

await machine.startJourney();

machine.subscribe(() => {
  const snap = machine.getSnapshot();
  console.log("step:", snap.currentStepId);
});

// User progresses
await machine.updateContext((ctx) => ({ ...ctx, name: "Alice" }));
await machine.goToNextStep(); // intro → profile

await machine.updateContext((ctx) => ({ ...ctx, agreed: true }));
await machine.goToNextStep(); // profile → confirm

await machine.completeJourney();
```
