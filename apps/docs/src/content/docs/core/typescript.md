---
id: typescript
title: TypeScript
sidebar_label: TypeScript
---

# TypeScript

Journey is TypeScript-first. Each factory has its own generic signature that enforces the mode's
contract at compile time, and most of the time you'll let inference do the work. This page covers the
patterns you'll reach for day to day.

:::tip
The [API reference](/docs/core/api/reference) has the full generated types for every export. This
page is the practical guide; that's the exhaustive one.
:::

## Factory signatures

```ts
// Linear — steps is an ordered array, no transitions field
createLinearJourney<TContext, TStepId, TStepMeta, THandlers, TPlugins>(
  def: LinearJourneyDefinition<TContext, TStepId, TStepMeta, THandlers>,
  options?: JourneyMachineOptions<TPlugins>
): LinearJourneyMachine<TContext, TStepId, TStepMeta, THandlers, TPlugins>;

// Graph — transitions required (builder output or plain definition)
createGraphJourney<TContext, TStepId, TEventMap, TStepMeta, THandlers, TPlugins>(
  def: GraphJourneyDefinition<TContext, TStepId, TEventMap, TStepMeta, THandlers>,
  options?: JourneyMachineOptions<TPlugins>
): JourneyMachineWithPlugins<TContext, TStepId, TEventMap, TStepMeta, THandlers, TPlugins>;

// Headless — initial required, no transitions
createHeadlessJourney<TContext, TStepId, TStepMeta, THandlers, TPlugins>(
  def: HeadlessJourneyDefinition<TContext, TStepId, TStepMeta, THandlers>,
  options?: JourneyMachineOptions<TPlugins>
): JourneyMachineWithPlugins<TContext, TStepId, never, TStepMeta, THandlers, TPlugins>;
```

## The four generics

All three factories share the same primary generics:

| Generic     | Models                                                                              |
| ----------- | ----------------------------------------------------------------------------------- |
| `TContext`  | Shared runtime data available to guards and transition callbacks                    |
| `TStepId`   | The union of valid step ids — keeps ids consistent across definition and navigation |
| `TStepMeta` | Per-step static metadata (labels, icons, descriptions)                              |
| `TEventMap` | Custom event types with payload shapes (graph mode only)                            |

## Defining types

```ts
import { createLinearJourney } from "@rxova/journey-core";

type StepId = "contact" | "details" | "review";
type Context = { email: string; dirty: boolean };
type StepMeta = { title: string };

const machine = createLinearJourney<Context, StepId, StepMeta>({
  context: { email: "", dirty: false },
  steps: [
    { id: "contact", meta: { title: "Contact" } },
    { id: "details", meta: { title: "Details" } },
    { id: "review", meta: { title: "Review" } }
  ]
});
```

## Custom events (graph)

`TEventMap` is what makes event payloads type-safe end to end:

```ts
import { createGraphJourneyBuilder, createGraphJourney } from "@rxova/journey-core";

type StepId = "form" | "confirm";
type Context = { email: string };
type Events = {
  saveDraft: { autosave: boolean };
  requestClose: { source: "button" | "shortcut" };
};

const { createStep, to, build } = createGraphJourneyBuilder<{
  context: Context;
  stepId: StepId;
  events: Events;
}>();

const machine = createGraphJourney(
  build({
    initial: "form",
    context: { email: "" },
    steps: [
      createStep("form", { on: { saveDraft: [to("form")], requestClose: [to("confirm")] } }),
      createStep("confirm", {})
    ]
  })
);

await machine.send({ type: "saveDraft", payload: { autosave: true } });
// await machine.send({ type: "saveDraft", payload: { autosave: "yes" } }); // ← TS error
```

## Typing snapshots and selectors

You rarely annotate `machine` directly — inference handles it. Explicit types earn their keep at the
edges: selectors, shared utilities, external adapters.

```ts
import type { JourneySnapshot, JourneySendResult } from "@rxova/journey-core";

type CheckoutSnapshot = JourneySnapshot<Context, StepId>;

const selectStep = (snap: CheckoutSnapshot) => snap.currentStepId;

const result: JourneySendResult<Context, StepId> = await machine.send({ type: "submit" });
if (!result.transitioned) {
  console.error(result.error);
}
```

## Context immutability

Journey can't enforce `Readonly` for you, but you can opt into compile-time protection by typing
context as `Readonly<T>`:

```ts
type Context = Readonly<{ email: string; step: number }>;
```

Now a stray mutation in a callback is a type error:

```ts
updateContext: ({ context }) => {
  context.email = "x"; // ← TS error: read-only property
  return { ...context, email: "x" }; // ok
};
```

:::note
`Readonly<T>` is shallow. For deep protection, reach for a recursive `DeepReadonly<T>` utility, or
keep context flat.
:::

## When to annotate, when to infer

- **Be explicit** for shared step-id unions, shared event maps, and reusable snapshot/result helpers.
- **Let inference win** for most `machine` variables, inline selectors, and transition callback args.

## Where to next

- [Graph builder](/docs/core/api/graph-builder) — typed per-step transitions and payload narrowing.
- [API overview](/docs/core/api) — the runtime surface these types describe.
