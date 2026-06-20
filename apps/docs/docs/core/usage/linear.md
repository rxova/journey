---
id: linear
title: Linear
sidebar_label: Linear
---

# Linear

Linear mode is the wizard workhorse. You hand `createLinearJourney` an ordered list of steps, and it
derives the transitions for you — `goToNextStep` advances through them, `goToPreviousStep` walks
back. No transition graph to declare; the order _is_ the graph.

:::info Good fit
Onboarding, checkout, multi-step forms, configuration wizards — anywhere "next" always means the
same thing.
:::

## Define a linear journey

Pass an ordered array of step ids. Each entry can be a plain string, or an object when you want
metadata or lifecycle callbacks.

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

If you don't need metadata or callbacks, the string shorthand is all you need:

```ts
const machine = createLinearJourney<Context, StepId>({
  context: { email: "", plan: null },
  steps: ["account", "details", "payment", "review"]
});
```

## Navigation

Sequential moves are the bread and butter:

```ts
await machine.goToNextStep(); // forward one
await machine.goToPreviousStep(); // back one
await machine.goToPreviousStep(2); // back two
```

There's also an index-based helper that's unique to linear machines. `goToStepByIndex` maps the
target index to the right primitive under the hood:

```ts
await machine.goToStepByIndex(0); // → goToPreviousStep (back to first)
await machine.goToStepByIndex(1); // → goToNextStep (next step)
await machine.goToStepByIndex(3); // → goToStepById (a forward jump)
```

:::note
`goToStepByIndex` is a `LinearJourneyMachine`-only method — graph and headless machines don't have
it. Out-of-bounds indices return `{ transitioned: false }` rather than throwing, so you can call it
straight from a clicked step without bounds-checking first.
:::

Reaching the end auto-completes the journey, unless you opt into explicit completion:

```ts
await machine.completeJourney(); // explicit completion
```

Pass `requireExplicitCompletion: true` in the options when you'd rather the last `goToNextStep`
_not_ auto-complete — handy when the final step has its own confirm button.

## Step lifecycle callbacks

Hook into entering and leaving a step without touching context — perfect for analytics or
prefetching:

```ts
steps: [
  {
    id: "payment",
    meta: { label: "Payment", icon: "card" },
    onEnter: () => analytics.track("payment_viewed"),
    onLeave: () => analytics.track("payment_left")
  }
];
```

These run after the move commits and can't block it — see
[Lifecycle & events](/docs/core/lifecycle#step-lifecycle-callbacks) for the exact timing.

## Linear-only computed state

`getComputed()` gives you the derived values a progress UI needs, already memoized. Narrow on
`mode === "linear"` to unlock the linear-specific fields:

```ts
const computed = machine.getComputed();

if (computed.mode === "linear") {
  computed.stepCount; // total steps
  computed.activeStepIndex; // current position
  computed.isFirstStep; // on index 0?
  computed.isLastStep; // on the final step?
  computed.stepOrder; // readonly ordered step ids
}
```

That's everything a progress bar or a back-button gate wants, without tracking it yourself:

```ts
const { stepCount, activeStepIndex } = machine.getComputed();
const progress = ((activeStepIndex + 1) / stepCount) * 100;
```

## Reading metadata and updating context

Static per-step data is always a call away:

```ts
const meta = machine.getStepMeta("payment");
meta?.label; // "Payment"
```

Context updates are separate from navigation — patch before or after a move:

```ts
await machine.updateContext((ctx) => ({ ...ctx, email: "ada@example.com" }));
await machine.goToNextStep();
```

## A complete flow

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
  console.log("step:", machine.getSnapshot().currentStepId);
});

await machine.updateContext((ctx) => ({ ...ctx, name: "Ada" }));
await machine.goToNextStep(); // intro → profile

await machine.updateContext((ctx) => ({ ...ctx, agreed: true }));
await machine.goToNextStep(); // profile → confirm

await machine.completeJourney();
```

## Where to next

- [Graph](./graph) — when "next" starts meaning different things.
- [Snapshot](/docs/core/snapshot) — the object your `subscribe` callback renders from.
- [Recipes](/docs/core/recipes) — short answers to common "how do I…" questions.
