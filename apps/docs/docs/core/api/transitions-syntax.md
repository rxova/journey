---
title: Transitions syntax
sidebar_label: Transitions syntax
---

# Transitions syntax

There are three ways to declare transitions, and they all compile to the same runtime model —
an ordered list where the first valid match wins. Pick the one that fits the flow; you can always
move up as it grows.

:::note
Reserved step ids — `*`, `global`, `COMPLETE`, and `TERMINATED` — are part of the runtime contract
and can't be used as step names of your own.
:::

## Linear shorthand

When the flow is a fixed `goToNextStep` sequence, an array is all you need:

```ts
const journey = {
  initial: "start",
  context: {},
  steps: { start: {}, details: {}, review: {} },
  transitions: ["start", "details", "review"]
};
```

That expands to `start → details → review` on `goToNextStep`. You can annotate a step without
leaving the linear form by replacing a string with an object:

```ts
const journey = {
  initial: "start",
  context: { completedSteps: 0 },
  steps: { start: {}, details: {}, review: {} },
  transitions: [
    "start",
    {
      step: "details",
      id: "start-next",
      timeoutMs: 5_000,
      updateContext: ({ context }) => ({ ...context, completedSteps: context.completedSteps + 1 })
    },
    "review"
  ]
};
```

In linear mode:

- strings are shorthand for the next step id;
- object entries use `step` (not `to`);
- object entries support `label`, `updateContext`, `onEnter`, `onLeave`, and `timeoutMs`;
- `when` is **not** supported — the moment a next step becomes conditional, move to the graph form.

## Graph object

When you need branching, custom events, async guards, or wildcard behavior, use the event-keyed
object:

```ts
const journey = {
  initial: "start",
  context: { canContinue: false },
  steps: { start: {}, details: {}, review: {} },
  transitions: {
    start: {
      goToNextStep: [{ id: "start-next", to: "details" }]
    },
    details: {
      goToNextStep: [
        { id: "details-guarded", to: "review", when: ({ context }) => context.canContinue },
        {
          id: "details-save",
          to: "review",
          updateContext: ({ context }) => ({ ...context, draftSaved: true })
        }
      ]
    },
    global: {
      requestClose: [{ to: "start", label: "restart-flow" }]
    }
  }
};
```

How it reads:

- top-level keys are source step ids;
- each event maps to an **ordered** array of candidate edges;
- each edge has a `to` plus optional `label`, `when`, `updateContext`, `onEnter`, `onLeave`, and
  `timeoutMs`;
- `global` is the wildcard bucket for cross-cutting fallbacks;
- `COMPLETE` and `TERMINATED` are terminal outcomes, not step ids.

Order matters inside each event array — Journey evaluates candidates top to bottom and takes the
first whose guard passes.

## Graph builder

`createGraphJourneyBuilder` is an alternative to the inline object: each step declares its own
transitions, so they can live next to the component that renders them. It compiles to the same
`JourneyDefinition` — no new runtime concepts.

```ts
const { createStep, to, build } = createGraphJourneyBuilder<Context, StepId, EventMap>();

export const loginStep = createStep("login", {
  on: {
    submit: [to("admin").when(({ context }) => context.role === "admin"), to("dashboard")]
  }
});

const definition = build({
  initial: "login",
  context: { role: "user" },
  steps: [loginStep, adminStep, dashboardStep]
});
```

Use the factory form of an `on` entry when you need `event.payload` narrowed to a specific event:

```ts
submit: ({ to }) => [to("admin").when(({ context, event }) => event.payload?.username !== "")];
```

The [Graph builder](./graph-builder) page covers the full API — `.label()`, `.timeoutMs()`,
`.updateContext()`, typed payloads, and file organization.

## Choosing a form

- **Linear array** — a fixed sequence you're teaching or shipping as-is.
- **Graph object** — branching, skips, retries, custom events, guards, or global behavior.
- **Graph builder** — a large flow, multiple owners, or transitions you want co-located with UI.

Most flows start linear and move to the graph form the moment the next step becomes conditional.

## Transition fields

| Field           | What it does                                                        |
| --------------- | ------------------------------------------------------------------- |
| `to`            | Target step or terminal outcome                                     |
| `when`          | Optional guard (sync or async)                                      |
| `updateContext` | Optional synchronous context updater                                |
| `onEnter`       | Optional observational callback, after commit, on the target side   |
| `onLeave`       | Optional observational callback, after commit, on the source side   |
| `timeoutMs`     | Optional finite millisecond cap for an async `when`                 |
| `label`         | Optional human-readable identifier surfaced in observability events |

For the runtime semantics of guards and updates, see [Async behavior](/docs/core/async).
