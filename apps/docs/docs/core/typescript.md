---
id: typescript
title: TypeScript
sidebar_label: TypeScript
---

Journey is TypeScript-first by design.

Types are not an add-on here. They are part of how you model steps, events, payloads, context, metadata, and machine behavior safely.

## Why It Matters

When transitions are typed, flow mistakes are caught earlier:

- invalid step ids
- invalid event names
- wrong payload shapes
- missing context fields in guards/effects

This reduces runtime surprises and makes refactors safer.

## Core Type Pattern

```ts
import {
  createJourneyMachine,
  createTransitions,
  tx,
  type JourneyDefinition
} from "@rxova/journey-core";

type StepId = "start" | "details" | "review";
type Event = "goToNextStep" | "completeJourney" | "requestClose";
type Context = { name: string; dirty: boolean };
type PayloadMap = {
  requestClose: { source: "button" | "shortcut" };
};

const journey: JourneyDefinition<Context, StepId, Event, PayloadMap> = {
  initial: "start",
  context: { name: "", dirty: false },
  steps: {
    start: {},
    details: {},
    review: {}
  },
  transitions: createTransitions(
    tx.from("start").on("goToNextStep").to("details"),
    tx.from("details").on("goToNextStep").to("review"),
    tx.from("review").toComplete()
  )
};

const machine = createJourneyMachine(journey);
```

## Event Payload Typing

With `PayloadMap`, event payload shape is enforced at callsites:

```ts
await machine.send({ type: "requestClose", payload: { source: "button" } });
// await machine.send({ type: "requestClose", payload: { source: 123 } }); // type error
```

## React Typing Model

`@rxova/journey-react` captures types once via bindings:

```ts
const bindings = createJourneyBindings(journey);
```

From there, `useJourneyApi`, `useJourneySnapshot`, and `useJourneyMachine` are already journey-typed, without repeating generics per hook call.

## Recommended Team Pattern

1. Define shared `StepId`, `Event`, and `Context` types near your journey definition.
2. Add a payload map once custom events carry structured payloads.
3. Keep transition ids stable (`id`) for better typed observability/debug logs.
4. Prefer inference where possible, add explicit generics where clarity helps.

## Related Docs

- [Core API](/docs/core/api)
- [Transition Syntax](/docs/core/api/transitions-syntax)
- [React Overview](/docs/react/overview)
