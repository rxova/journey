---
id: typescript
title: TypeScript
sidebar_label: TypeScript
---

# TypeScript

Journey is TypeScript-first. The three factory functions each accept a distinct, non-overlapping generic signature that enforces mode-specific contracts at compile time.

:::tip
The [API Reference](/docs/core/api/reference) has the full generated type documentation for every export. This page covers the patterns you'll actually use day-to-day.
:::

## Factory Generic Signatures

```ts
// Linear — steps is an ordered array, no transitions field
createLinearJourney<TContext, TStepId, TStepMeta, THandlers, TPlugins>(
  def: LinearJourneyDefinition<TContext, TStepId, TStepMeta, THandlers>,
  options?: JourneyMachineOptions<TPlugins>
): LinearJourneyMachine<TContext, TStepId, TStepMeta, THandlers, TPlugins>

// Graph — transitions required, builder output or plain definition
createGraphJourney<TContext, TStepId, TEventMap, TStepMeta, THandlers, TPlugins>(
  def: GraphJourneyDefinition<TContext, TStepId, TEventMap, TStepMeta, THandlers>,
  options?: JourneyMachineOptions<TPlugins>
): JourneyMachineWithPlugins<TContext, TStepId, TEventMap, TStepMeta, THandlers, TPlugins>

// Headless — initial required, no transitions
createHeadlessJourney<TContext, TStepId, TStepMeta, THandlers, TPlugins>(
  def: HeadlessJourneyDefinition<TContext, TStepId, TStepMeta, THandlers>,
  options?: JourneyMachineOptions<TPlugins>
): JourneyMachineWithPlugins<TContext, TStepId, never, TStepMeta, THandlers, TPlugins>
```

## Four Generic Inputs

All three factories share the same four primary generics:

| Generic     | What it models                                                                  |
| ----------- | ------------------------------------------------------------------------------- |
| `TContext`  | Shared runtime data available to guards and transition callbacks                |
| `TStepId`   | Union of valid step ids — keeps ids consistent across definition and navigation |
| `TStepMeta` | Per-step static metadata shape (labels, icons, descriptions)                    |
| `TEventMap` | Custom event types with payload shapes (graph mode only)                        |

## Defining Types

```ts
import { createLinearJourney } from "@rxova/journey-core";

type StepId = "contact" | "details" | "review";

type Context = {
  email: string;
  dirty: boolean;
};

type StepMeta = {
  title: string;
};

const machine = createLinearJourney<Context, StepId, StepMeta>({
  context: { email: "", dirty: false },
  steps: [
    { id: "contact", meta: { title: "Contact" } },
    { id: "details", meta: { title: "Details" } },
    { id: "review", meta: { title: "Review" } }
  ]
});
```

## Custom Events (Graph)

```ts
import { createGraphJourneyBuilder, createGraphJourney } from "@rxova/journey-core";

type StepId = "form" | "confirm";
type Context = { email: string };
type Events = {
  saveDraft: { autosave: boolean };
  requestClose: { source: "button" | "shortcut" };
};

const { createStep, to, build } = createGraphJourneyBuilder<Context, StepId, Events>();

const machine = createGraphJourney(
  build({
    initial: "form",
    context: { email: "" },
    steps: [
      createStep("form", {
        on: {
          saveDraft: [to("form")],
          requestClose: [to("confirm")]
        }
      }),
      createStep("confirm", {})
    ]
  })
);

// Payload is fully typed
await machine.send({ type: "saveDraft", payload: { autosave: true } });
// await machine.send({ type: "saveDraft", payload: { autosave: "yes" } }); // TS error
```

## Typing Snapshots and Selectors

Most teams don't annotate `machine` directly — inference is usually enough. Explicit types help at the edges: selectors, shared utilities, and external adapters.

```ts
import type { JourneySnapshot, JourneySendResult } from "@rxova/journey-core";

type CheckoutSnapshot = JourneySnapshot<Context, StepId>;

const selectStep = (snap: CheckoutSnapshot) => snap.currentStepId;

// Typing send results
const result: JourneySendResult<Context, StepId> = await machine.send({ type: "submit" });
if (!result.transitioned) {
  console.error(result.error);
}
```

## Context Immutability

Journey cannot enforce `Readonly` internally. If you want compile-time mutation protection, type your context as `Readonly<T>`:

```ts
type Context = Readonly<{
  email: string;
  step: number;
}>;
```

Guards and `updateContext` callbacks will then reject direct mutations:

```ts
updateContext: ({ context }) => {
  context.email = "x"; // TS error: read-only property
  return { ...context, email: "x" }; // ok
};
```

:::note
`Readonly<T>` is shallow. For deep protection, use a recursive utility like `DeepReadonly<T>` from a utility library, or keep context flat.
:::

## When to Let Inference Win

Be explicit for shared step id unions, shared event maps, and reusable snapshot or result helpers.

Let inference win for most `machine` variables, inline selectors, and transition callback arguments.
