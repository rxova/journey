---
title: Graph Builder
sidebar_label: Graph Builder
---

# Graph Builder

`createGraphJourneyBuilder` is an alternative way to write graph-mode definitions. Instead of one central transition object, each step declares its own transitions and can be co-located with its component. The builder compiles to the same `JourneyDefinition` that `createJourneyMachine` and `createJourney` already accept — no new runtime concepts.

Use it when:

- the central transition object is hard to navigate or review in PRs
- the team is not familiar with state machine syntax and finds the per-step style easier to read
- you want to co-locate routing logic with the component that renders each step

## Setup

Call `createGraphJourneyBuilder` once, typed with the same generics as your definition. It returns three functions: `createStep`, `to`, and `build`.

```ts
import { createGraphJourneyBuilder } from "@rxova/journey-core";

type Context = { role: "user" | "admin"; name: string };
type StepId = "login" | "dashboard" | "admin" | "blocked";
type EventMap = { submit: { username: string }; back: unknown };
type StepMeta = { label: string };

const { createStep, to, build } = createGraphJourneyBuilder<Context, StepId, EventMap, StepMeta>();
```

The builder is fully generic: `to` only accepts valid `StepId` values, event keys in `on` are constrained to `EventMap` plus the built-in events, and guard and `updateContext` callbacks are typed against `Context`.

## Defining Steps

`createStep` creates a single step definition. Pass the step id and an optional config object with `meta` and `on`.

```ts
// step with no transitions (terminal step)
export const blockedStep = createStep("blocked", {
  meta: { label: "Blocked" }
});

// step with transitions
export const loginStep = createStep("login", {
  meta: { label: "Login" },
  on: {
    submit: [to("admin").when(({ context }) => context.role === "admin"), to("dashboard")],
    back: [to("blocked")]
  }
});
```

Step files can live anywhere and are just values — import them wherever you assemble the definition.

## `to()` — Fluent Transitions

`to(stepId)` creates a transition target and returns a builder with four chainable methods:

| Method               | Description                                                                                   |
| -------------------- | --------------------------------------------------------------------------------------------- |
| `.when(guard)`       | Guard function. Receives `{ context, from, timeline, index, event }`. Return `true` to allow. |
| `.updateContext(fn)` | Sync context updater. Return the next context object for the committed transition.            |
| `.label(string)`     | Human-readable identifier included in observability and debugging events.                     |
| `.timeoutMs(number)` | Per-transition timeout. Throws `JourneyTimeoutError` if exceeded.                             |

Each method is immutable — it returns a new builder without modifying the original.
Each modifier is also single-use at the type level: calling `.when()`, `.updateContext()`,
`.onEnter()`, `.onLeave()`, `.label()`, or `.timeoutMs()` twice on the same transition is a
TypeScript error. If you bypass the type system, runtime behavior stays last-call-wins.

```ts
to("dashboard")
  .label("login-to-dashboard")
  .when(({ context }) => context.name !== "")
  .updateContext(({ context }) => {
    return { ...context, profileRequested: true };
  })
  .timeoutMs(5000);
```

## Assembling the Definition

`build` collects step builders into a `JourneyDefinition`. Pass it like any other definition to `createJourneyMachine` or `createJourney`.

```ts
import { createJourney } from "@rxova/journey-react";
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

export const journey = createJourney(definition);
```

`build` accepts the same `global` shorthand as the inline graph object: `true`, `[]`, or an array of `to()` builders.

## Full Example

```ts
// builder.ts — typed singleton, no local deps
import { createGraphJourneyBuilder } from "@rxova/journey-core";
import type { Context, StepId, EventMap, StepMeta } from "./types";

export const { createStep, to, build } = createGraphJourneyBuilder<
  Context,
  StepId,
  EventMap,
  StepMeta
>();
```

```ts
// steps/login.step.ts — co-located with Login.tsx
import { createStep, to } from "../builder";
import { mockApi } from "../api";

export const loginStep = createStep("login", {
  meta: { label: "Login", icon: "🔑" },
  on: {
    submit: [
      to("admin").when(({ context }) => context.role === "admin"),
      to("dashboard")
        .when(({ context }) => context.name !== "")
        .updateContext(({ context }) => ({
          ...context,
          profileRequested: true
        }))
    ]
  }
});
```

```ts
// journey.ts — one-screen assembly
import { createJourney } from "@rxova/journey-react";
import { build } from "./builder";
import { loginStep } from "./steps/login.step";
import { dashboardStep } from "./steps/dashboard.step";
import { adminStep } from "./steps/admin.step";

const definition = build({
  initial: "login",
  context: { role: "user", name: "" },
  steps: [loginStep, dashboardStep, adminStep]
});

export const journey = createJourney(definition);
```

## Typed Event Payloads

By default, `event` in guards and `updateContext` callbacks is typed as the broad union of all events in `EventMap`. This is fine for guards that only use `context`.

When you need `event.payload` narrowed to the specific event type, use the **factory form** for the `on` entry. Pass a function that receives an event-typed `to`:

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
      to("admin").when(({ context, event }) => {
        // event.payload is fully typed here
        return context.role === "admin" && event.payload?.username !== "";
      }),
      to("dashboard")
    ],

    // Simple form: still works, event is the broad union
    back: [to("blocked")]
  }
});
```

The factory receives its own scoped `to` typed for that event. Call it exactly like the outer `to`. Both forms can be mixed freely across different events on the same step.

## File Organization

A typical layout for larger flows:

```
src/
  types.ts               ← StepId, Context, EventMap, StepMeta
  api.ts                 ← shared API calls (no local deps)
  builder.ts             ← createGraphJourneyBuilder instance
  steps/
    Login.tsx            ← component
    login.step.ts        ← step builder (imports builder + api)
    Dashboard.tsx
    dashboard.step.ts
    ...
  journey.ts             ← build() + createJourney()
```

`builder.ts` imports only from `types.ts` and `@rxova/journey-core`. Step files import from `builder.ts` and `api.ts`. `journey.ts` imports from all step files. Components import from `journey.ts`. No circular dependencies.

## Builder vs. Inline Graph Object

|                             | Inline graph object          | Builder                         |
| --------------------------- | ---------------------------- | ------------------------------- |
| Transitions location        | One central object           | Per-step files                  |
| PR review                   | Entire flow in one diff      | Only changed steps              |
| Co-location with UI         | No                           | Yes                             |
| Boilerplate                 | Minimal                      | Slight upfront setup            |
| Custom event payload typing | Full (per-edge `event.type`) | Full via factory form           |
| Output                      | `JourneyDefinition`          | `JourneyDefinition` (identical) |

Both produce the same internal representation and are fully interchangeable. The inline object is often the right choice for small flows or when all transitions are authored by one person. The builder pays off when the flow grows, when multiple people own different steps, or when transitions feel disconnected from the components they drive.
