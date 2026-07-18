---
id: graph-builder
title: Graph builder
---

# Graph builder

`createGraphJourneyBuilder` gives a graph one shared type bag and lets each step declare its outgoing
transitions beside its hooks and metadata. `build()` returns the same definition shape accepted by
`createGraphJourney`.

## Setup

```ts
import { createGraphJourney, createGraphJourneyBuilder } from "@rxova/journey-core";

type Context = { role: "member" | "admin" };
type StepId = "login" | "dashboard" | "admin";
type Event = { type: "SUBMIT"; payload: { username: string } } | { type: "LOG_OUT" };
type Meta = { title: string };
type Handlers = { isAdmin(role: Context["role"]): boolean };

const { createStep, to, build } = createGraphJourneyBuilder<{
  context: Context;
  stepId: StepId;
  events: Event;
  meta: Meta;
  handlers: Handlers;
}>();
```

`meta` and `handlers` are optional type-bag fields. Without them, metadata defaults to
`Record<string, unknown>` and handlers to an empty record.

## Define steps

```ts
const login = createStep("login", {
  metadata: { title: "Sign in" },
  on: {
    SUBMIT: ({ to }) => [
      to("admin").when(({ context, handlers }) => handlers.isAdmin(context.role)),
      to("dashboard").onTransition(({ event, updateContext }) => {
        console.log(event?.payload.username);
        updateContext((context) => context);
      })
    ]
  }
});

const dashboard = createStep("dashboard", {
  metadata: { title: "Dashboard" },
  on: { LOG_OUT: [to("login")] }
});

const admin = createStep("admin", {
  metadata: { title: "Admin" },
  on: { LOG_OUT: [to("login")] }
});
```

The callback form gives `to` the current event type, so `onTransition` sees its narrowed payload.
The array form is shorter when payload narrowing is unnecessary.

## Declare event work

The callback form also receives `work`, which lets the event carry its own async: `run` executes,
`commit` stages context from the result, and the candidates route on the staged context.

```ts
const login = createStep("login", {
  on: {
    SUBMIT: ({ to, work }) =>
      work({
        run: ({ snapshot, handlers }) => handlers.authenticate(snapshot.context.username),
        commit: ({ result, updateContext }) =>
          updateContext((context) => ({ ...context, authenticated: result.ok })),
        candidates: [to("dashboard").when(({ context }) => context.authenticated), to("login")]
      })
  }
});
```

The transactional semantics — staging, rollback when no candidate is enabled, and the totality
rule — are covered in [Graph § Transactional sends](../usage/graph#transactional-sends-event-work).

## Build and run

```ts
const definition = build({
  initial: "login",
  context: { role: "member" },
  handlers: { isAdmin: (role) => role === "admin" },
  steps: [login, dashboard, admin]
});

const machine = createGraphJourney(definition);
machine.controls.start();
await waitUntilSettled(machine);
await machine.send("SUBMIT", { username: "ada" });
```

`build` rejects duplicate step ids. Graph factory validation checks the initial id and every
transition reference.

## File organization

Create the builder once and export `createStep` and `to`. Individual step modules can import those
helpers without repeating generics. Assemble the step list and call `build` in one definition
module.

The builder is only an authoring layer. It does not add runtime behavior or bundle a second engine.

## Where to next

- [Graph](../usage/graph)
- [TypeScript](../typescript)
- [Transitions syntax](./transitions-syntax)
