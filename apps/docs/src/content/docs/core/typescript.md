---
title: "TypeScript"
---

Journey is TypeScript-first by design.

The current public model is centered on four generic inputs:

- context
- step ids
- an event map
- optional step metadata

## The Core Generic Shape

The main type most teams start from is `JourneyDefinition`:

```ts
type JourneyDefinition<
  TContext,
  TStepId extends string,
  TEventMap extends Record<string, unknown> = Record<never, never>,
  TStepMeta = unknown
>
```

That generic shape gives you four important places to customize the machine model:

- `TContext`: shared runtime data
- `TStepId`: valid step ids
- `TEventMap`: custom events keyed by name, with payload types as values
- `TStepMeta`: per-step definition metadata shape

## A Fully Typed Definition

```ts
import { createJourneyMachine, type JourneyDefinition } from "@rxova/journey-core";

type StepId = "contact" | "details" | "review";
type Context = {
  email: string;
  dirty: boolean;
};
type EventMap = {
  requestClose: { source: "button" | "shortcut" };
};
type StepMeta = {
  title: string;
};

const journey: JourneyDefinition<Context, StepId, EventMap, StepMeta> = {
  initial: "contact",
  context: {
    email: "",
    dirty: false
  },
  steps: {
    contact: { meta: { title: "Contact" } },
    details: { meta: { title: "Details" } },
    review: { meta: { title: "Review" } }
  },
  transitions: {
    contact: {
      goToNextStep: [{ to: "details" }]
    },
    details: {
      goToNextStep: [{ to: "review" }]
    },
    review: {
      completeJourney: true
    },
    global: {
      requestClose: [
        {
          to: "review",
          when: ({ event }) => event.payload?.source === "shortcut"
        }
      ]
    }
  }
};

const machine = createJourneyMachine(journey);
machine.startJourney();
```

## Important Types To Know

### `JourneyDefinition`

This is the authoring type for the machine definition itself. It enforces that step ids used in `initial`, `steps`, and transitions all agree.

### `JourneySendEvent`

This is the event union accepted by `machine.send(...)`. It combines the built-in navigation events with the custom events derived from your event map.

### `JourneySnapshot`

This is the runtime state shape returned by `machine.getSnapshot()`. When you annotate selectors, helpers, or external adapters, this is usually the type you want.

### `JourneySendResult`

This is the resolved result from `send(...)` and convenience helpers. It is useful when your calling code needs to know whether a transition happened, which transition id matched, or whether an error occurred.

### `JourneyObservationEvent`

This is the lifecycle event union emitted by the machine. If you want a specific lifecycle member, prefer the named event types such as `JourneyStartObservationEvent`, `JourneyCompleteObservationEvent`, or `JourneyTerminateObservationEvent`.

## Custom Events And Payloads

The event map is the canonical way to model custom events.

```ts
type EventMap = {
  saveDraft: { autosave: boolean };
  requestClose: { source: "button" | "shortcut" };
};

const journey: JourneyDefinition<Context, StepId, EventMap> = {
  initial: "contact",
  context: { email: "", dirty: false },
  steps: {
    contact: {},
    details: {}
  },
  transitions: {
    contact: {
      saveDraft: [{ to: "contact" }],
      goToNextStep: [{ to: "details" }]
    }
  }
};

await machine.send({ type: "saveDraft", payload: { autosave: true } });
// await machine.send({ type: "saveDraft", payload: { autosave: "yes" } }); // type error
```

Legacy aliases like `JourneyCustomEvent`, `JourneyEventType`, and `JourneyEventPayloadMap` still exist for compatibility, but new code should prefer an event map directly.

## Typing Snapshots And Selectors

Most teams do not need to annotate `machine` directly because inference is usually enough. Where explicit types help is at the edges: selectors, utilities, and external adapters.

```ts
import type { JourneySnapshot } from "@rxova/journey-core";

type CheckoutSnapshot = JourneySnapshot<Context, StepId>;

const selectCurrentStep = (snapshot: CheckoutSnapshot) => snapshot.currentStepId;
```

## Typing Send Results

If a caller needs to react differently based on success or failure, annotate the result instead of re-deriving it.

```ts
import type { JourneySendResult } from "@rxova/journey-core";

const result: JourneySendResult<Context, StepId> = await machine.send({
  type: "requestClose",
  payload: { source: "button" }
});

if (!result.transitioned) {
  console.error(result.error);
}
```

## Context Immutability

Journey cannot enforce `Readonly` on `TContext` internally — doing so would require transition updaters to return `Readonly<TContext>`, which creates friction with object spread and breaks the common pattern of returning the next context object.

If you want **compile-time mutation protection**, type your context as `Readonly<T>` yourself:

```ts
type Context = Readonly<{
  email: string;
  step: number;
}>;
```

Everything that touches context — guards and transition `updateContext` callbacks — will then reject direct mutations:

```ts
updateContext: ({ context }) => {
  context.email = "x"; // type error: cannot assign to 'email' because it is read-only
  return { ...context, email: "x" }; // ok
};
```

`Readonly<T>` is shallow — nested objects are still mutable at their own level. For deep protection, use a recursive utility like `DeepReadonly<T>` from a utility library, or flatten nested state into a single level.

## When To Let Inference Win

Be explicit for:

- shared step id unions
- shared event maps
- reusable snapshot or result helpers

Let inference win for:

- most `machine` variables
- most inline selectors
- transition callback argument types

That balance usually gives the best readability without turning every line into generic noise.

## Recommended Team Pattern

1. Define `StepId`, `Context`, and `EventMap` next to the journey.
2. Use `transitions: ["a", "b", "c"]` for simple sequences.
3. Switch to the event-keyed transition graph when the flow starts branching.
4. Put renderer-specific per-step configuration inside `meta`.

## Related Docs

- [Quickstart](./getting-started.md)
- [Usage](./usage.md)
- [Transition Syntax](./api/transitions-syntax.md)
