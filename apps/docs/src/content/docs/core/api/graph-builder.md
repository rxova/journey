---
title: Graph builder
sidebar_label: Graph builder
---

# Graph builder

`createGraphJourneyBuilder` is a per-step way to write graph definitions. Instead of one central
transition object, each step declares its own transitions and can sit next to the component that
renders it. It compiles to the same `JourneyDefinition` the factories already accept — no new runtime
concepts.

Reach for it when:

- the central transition object is hard to review in a PR diff;
- the team finds the per-step style easier to read than one big state object;
- you want routing logic co-located with the component for each step.

## Setup

Call `createGraphJourneyBuilder` once, typed with the same generics as your definition. It returns
`createStep`, `to`, and `build`:

```ts
import { createGraphJourneyBuilder } from "@rxova/journey-core";

type Context = { role: "user" | "admin"; name: string };
type StepId = "login" | "dashboard" | "admin" | "blocked";
type EventMap = { submit: { username: string }; back: unknown };
type StepMeta = { label: string };

const { createStep, to, build } = createGraphJourneyBuilder<Context, StepId, EventMap, StepMeta>();
```

Everything is generic: `to` accepts only valid `StepId`s, event keys in `on` are constrained to
`EventMap` plus the built-ins, and guard and `updateContext` callbacks are typed against `Context`.

## Defining steps

`createStep` takes a step id and an optional config with `meta` and `on`:

```ts
export const blockedStep = createStep("blocked", { meta: { label: "Blocked" } });

export const loginStep = createStep("login", {
  meta: { label: "Login" },
  on: {
    submit: [to("admin").when(({ context }) => context.role === "admin"), to("dashboard")],
    back: [to("blocked")]
  }
});
```

Step files are just values — import them wherever you assemble the definition.

## `to()` — fluent transitions

`to(stepId)` returns a transition builder with chainable, immutable methods:

| Method                          | What it does                                                                         |
| ------------------------------- | ------------------------------------------------------------------------------------ |
| `.when(guard)`                  | Guard. Receives `{ context, from, timeline, index, event }`; return `true` to allow. |
| `.updateContext(fn)`            | Synchronous context updater; return the next context for the committed move.         |
| `.onEnter(fn)` / `.onLeave(fn)` | Observational callbacks after commit.                                                |
| `.label(string)`                | Human-readable identifier in observability and debugging events.                     |
| `.timeoutMs(number)`            | Per-transition timeout; throws `JourneyTimeoutError` if exceeded.                    |

Each method returns a new builder without mutating the original, and each is **single-use at the
type level** — calling `.when()`, `.updateContext()`, `.onEnter()`, `.onLeave()`, `.label()`, or
`.timeoutMs()` twice on the same transition is a TypeScript error. (If you bypass the types, runtime
behavior is last-call-wins.)

```ts
to("dashboard")
  .label("login-to-dashboard")
  .when(({ context }) => context.name !== "")
  .updateContext(({ context }) => ({ ...context, profileRequested: true }))
  .timeoutMs(5000);
```

## Assembling the definition

`build` collects step builders into a `JourneyDefinition`. Pass the result to `createGraphJourney`:

```ts
import { createGraphJourney } from "@rxova/journey-core";
import { build } from "./builder";
import { loginStep } from "./steps/login.step";
import { dashboardStep } from "./steps/dashboard.step";
import { adminStep } from "./steps/admin.step";
import { blockedStep } from "./steps/blocked.step";

const definition = build({
  initial: "login",
  context: { role: "user", name: "" },
  steps: [loginStep, dashboardStep, adminStep, blockedStep]
});

export const machine = createGraphJourney(definition);
```

`build` accepts the same `global` shorthand as the inline object: `true`, `[]`, or an array of `to()`
builders.

:::note
In React, pass the same `build(...)` output to `createJourney` from `@rxova/journey-react` instead —
the builder output is identical, only the consumer differs.
:::

## Typed event payloads

By default, `event` in callbacks is the broad union of everything in `EventMap`, which is fine when a
guard only reads `context`. When you need `event.payload` narrowed to a specific event, use the
**factory form** of the `on` entry — a function that receives an event-typed `to`:

```ts
type EventMap = {
  submit: { username: string; password: string };
  back: unknown;
};

createStep("login", {
  on: {
    // Factory form: `to` is typed for "submit" — event.payload is
    // { username: string; password: string } | undefined
    submit: ({ to }) => [
      to("admin").when(
        ({ context, event }) => context.role === "admin" && event.payload?.username !== ""
      ),
      to("dashboard")
    ],
    // Simple form still works; event is the broad union
    back: [to("blocked")]
  }
});
```

You can mix the two forms freely across events on the same step.

## File organization

A layout that scales for larger flows:

```text
src/
  types.ts        ← StepId, Context, EventMap, StepMeta
  api.ts          ← shared API calls (no local deps)
  builder.ts      ← createGraphJourneyBuilder instance
  steps/
    Login.tsx         ← component
    login.step.ts     ← step builder (imports builder + api)
    Dashboard.tsx
    dashboard.step.ts
  journey.ts      ← build() + createGraphJourney()
```

`builder.ts` imports only `types.ts` and `@rxova/journey-core`. Step files import from `builder.ts`
and `api.ts`. `journey.ts` imports the step files. Components import from `journey.ts`. No circular
dependencies.

## Builder vs. inline object

|                       | Inline graph object          | Builder                         |
| --------------------- | ---------------------------- | ------------------------------- |
| Transitions location  | One central object           | Per-step files                  |
| PR review             | Whole flow in one diff       | Only changed steps              |
| Co-location with UI   | No                           | Yes                             |
| Boilerplate           | Minimal                      | Slight upfront setup            |
| Custom payload typing | Full (per-edge `event.type`) | Full via factory form           |
| Output                | `JourneyDefinition`          | `JourneyDefinition` (identical) |

Both produce the same internal representation and are interchangeable. The inline object suits small
flows owned by one person; the builder pays off as the flow grows and steps gain different owners.

## Where to next

- [Graph mode](/docs/core/usage/graph) — the builder in the context of a full flow.
- [Transitions syntax](/docs/core/api/transitions-syntax) — the inline forms it compiles to.
- [TypeScript](/docs/core/typescript) — the generics behind the inference.
