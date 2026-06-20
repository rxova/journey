---
id: getting-started
title: Quickstart
sidebar_label: Quickstart
---

import Tabs from "@theme/Tabs";
import TabItem from "@theme/TabItem";

# Quickstart

Let's build a working checkout flow in a few minutes. We'll define it, start it, move through it,
read its state, and react to changes — the same loop you'll use for every Journey machine. By the
end you'll have run all five of the core moves and know where to go deeper.

## Install

`@rxova/journey-core` runs in any standard ESM runtime and needs no UI framework. It has zero
dependencies.

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

## Define a flow

Our checkout has four steps in a fixed order, so we'll reach for `createLinearJourney`. You hand it
a starting context and an ordered list of steps; Journey wires up "next" and "back" for you.

```ts title="checkout.ts"
import { createLinearJourney } from "@rxova/journey-core";

type StepId = "account" | "details" | "payment" | "review";
type Context = { email: string; plan: string | null };

export const checkout = createLinearJourney<Context, StepId>({
  context: { email: "", plan: null },
  steps: ["account", "details", "payment", "review"]
});
```

That's a complete, type-safe flow. `StepId` keeps every navigation call honest — misspell a step
and TypeScript stops you — and `Context` types the data the flow carries.

## Start and drive it

A fresh machine sits in the `idled` status until you start it. After that, you move through the
steps and patch context as you go.

```ts
await checkout.startJourney(); // status: idled → running, on "account"

await checkout.updateContext((ctx) => ({ ...ctx, email: "ada@example.com" }));
await checkout.goToNextStep(); // account → details
await checkout.goToNextStep(); // details → payment

await checkout.goToPreviousStep(); // back to details
```

Every navigation call returns a result you can inspect — whether it `transitioned`, the new
`snapshot`, and any `error`. For a linear flow the happy path rarely fails, but in graph mode
(where guards can reject a move) that result is how you find out what happened.

## Read the snapshot

At any moment, one object describes the whole flow. This is what your UI renders from.

```ts
const snapshot = checkout.getSnapshot();

snapshot.currentStepId; // "details"
snapshot.history.timeline; // ["account", "details", "payment", "details"]
snapshot.context; // { email: "ada@example.com", plan: null }
snapshot.status; // "running"
```

Need derived values like "which step number is this" or "is this the last step"? Ask `getComputed()`
instead of calculating by hand:

```ts
const computed = checkout.getComputed();
if (computed.mode === "linear") {
  const progress = (computed.activeStepIndex + 1) / computed.stepCount;
}
```

## Subscribe

Your UI re-renders by subscribing. Subscribe to every change, or to one slice of state with a
selector so you only react when that slice changes.

```ts
// Fires on any snapshot change.
const unsubscribe = checkout.subscribe(() => {
  render(checkout.getSnapshot());
});

// Fires only when the current step changes.
checkout.subscribeSelector(
  (snapshot) => snapshot.currentStepId,
  (next, previous) => console.log(`${previous} → ${next}`)
);
```

When you're done with a machine, call `unsubscribe()` and `checkout.dispose()` to tear it down.

## Finish it

When the user reaches the end, move the flow to a terminal status:

```ts
await checkout.completeJourney(); // status → "completed"
// or, if they bail out:
await checkout.terminateJourney(); // status → "terminated"
```

Terminal flows stay put — further navigation does nothing until you call `resetJourney()`. That's
on purpose: a finished checkout shouldn't quietly accept another "next."

## The other two modes

We used linear because checkout is a fixed sequence. When your flow branches or its path is decided
elsewhere, the same runtime has two more factories — same snapshot, same API, different way of
choosing the next step.

```ts
// Graph: branching with guards and custom events.
import { createGraphJourney, createGraphJourneyBuilder } from "@rxova/journey-core";

// Headless: the caller picks each step at runtime.
import { createHeadlessJourney } from "@rxova/journey-core";
```

[Choosing a mode](/docs/core/usage) helps you pick, and each mode has its own guide.

:::note
Reserved step ids — `*`, `global`, `COMPLETE`, and `TERMINATED` — are used by the runtime and can't
be step names of your own.
:::

## Where to next

- [Core concepts](/docs/core/concepts) — the vocabulary behind everything you just ran.
- [Choosing a mode](/docs/core/usage) — linear vs. graph vs. headless.
- [Snapshot](/docs/core/snapshot) — the full field guide to the object you render from.
- [Plugins](/docs/core/plugins/overview) — add persistence, autosave, analytics, and more.
