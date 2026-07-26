---
title: "Transition Syntax"
---

Journey supports two current ways to define transitions:

- linear step arrays for simple sequential flows
- event-keyed graph objects for branching or cross-cutting flow logic

Both resolve to the same runtime model. Transition matching stays deterministic: first valid transition wins.

Reserved step ids: `*`, `global`, `COMPLETE`, and `TERMINATED`. They are part of the runtime contract and cannot be reused as actual step names.

## Option A: Linear Shorthand

Use a linear array when the flow is just a fixed `goToNextStep` sequence.

```ts
const journey = {
  initial: "start",
  context: {},
  steps: {
    start: {},
    details: {},
    review: {}
  },
  transitions: ["start", "details", "review"]
};
```

This is shorthand for:

- `start --goToNextStep--> details`
- `details --goToNextStep--> review`

You can also annotate the next step without switching to graph syntax:

```ts
const journey = {
  initial: "start",
  context: { draftId: null },
  steps: {
    start: {},
    details: {},
    review: {}
  },
  transitions: [
    "start",
    {
      step: "details",
      id: "start-next",
      timeoutMs: 5_000,
      updateContext: ({ context }) => ({
        ...context,
        completedSteps: context.completedSteps + 1
      })
    },
    "review"
  ]
};
```

In linear mode:

- strings are shorthand for the next step id
- object entries use `step`, not `to`
- object entries support `label`, `updateContext`, `onEnter`, `onLeave`, and `timeoutMs`
- `when` is not supported

It is best when the flow really is linear and you do not need branching, custom events, guards, or explicit terminal transitions.

## Option B: Transition Graph Object

Use the graph object when you need branching, custom events, async logic, or wildcard behavior.

```ts
const journey = {
  initial: "start",
  context: { canContinue: false },
  steps: {
    start: {},
    details: {},
    review: {}
  },
  transitions: {
    start: {
      goToNextStep: [{ id: "start-next", to: "details" }]
    },
    details: {
      goToNextStep: [
        {
          id: "details-next-guarded",
          to: "review",
          when: ({ context }) => context.canContinue
        },
        {
          id: "details-save",
          to: "review",
          updateContext: ({ context }) => ({
            ...context,
            draftSaved: true
          })
        }
      ]
    },
    review: {
      completeJourney: true
    },
    global: {
      terminateJourney: [{ label: "cancel-anywhere" }]
    }
  }
};
```

## How The Graph Object Works

- Top-level keys are source step ids.
- Event names under each step map to ordered arrays of candidate edges.
- Each edge is an object containing `to` plus optional `label`, `when`, `updateContext`, `onEnter`, `onLeave`, and `timeoutMs`.
- `global` is the reserved wildcard bucket for fallback cross-cutting transitions.
- `COMPLETE` and `TERMINATED` are reserved terminal outcomes, not regular step ids.

Order matters inside each event array. Journey evaluates the candidates in order and picks the first valid match.

## Option C: Graph Builder

`createJourneyBuilder` is an alternative to the inline graph object. Instead of one central transition object, each step declares its own transitions and can be co-located with its component. The builder compiles to the same `JourneyDefinition` — no new runtime concepts.

```ts
// builder.ts — typed singleton, no local deps
const { createStep, to, build } = createJourneyBuilder<Context, StepId, EventMap>();

// steps/login.step.ts — co-located with Login.tsx
export const loginStep = createStep("login", {
  on: {
    submit: [to("admin").when(({ context }) => context.role === "admin"), to("dashboard")]
  }
});

// journey.ts — one-screen assembly
const definition = build({
  initial: "login",
  context: { role: "user" },
  steps: [loginStep, adminStep, dashboardStep]
});
```

Use the **factory form** when you need `event.payload` narrowed to the specific event type:

```ts
submit: ({ to }) => [to("admin").when(({ context, event }) => event.payload?.username !== "")];
```

See the [Graph Builder API reference](./graph-builder.md) for the full API including `.label()`, `.timeoutMs()`, `.updateContext()`, typed event payloads, and file organization patterns.

## Which Style Should You Use?

- Choose the linear array when the doc or feature is teaching a simple fixed sequence.
- Choose the graph object when the flow has branching, skips, retries, custom events, guards, lifecycle callbacks, or global behavior.
- Choose the graph builder when the flow is large, multiple people own different steps, or you want transitions co-located with the components that drive them.
- Move from linear to graph as soon as the next step itself becomes conditional.

Most real product flows start with the linear shorthand and then move to the graph object (or builder) as soon as the sequence stops being fixed.

## Transition Fields

Core fields you can use in transition records and graph edges:

- `to`: target step or terminal outcome
- `when`: optional guard (sync or async)
- `updateContext`: optional synchronous context updater
- `onEnter`: optional observational callback after commit on the target side
- `onLeave`: optional observational callback after commit on the source side
- `timeoutMs`: optional finite millisecond limit for async `when`
- `label`: optional human-readable identifier included in observability/debugging events

For runtime semantics of guards and context updates, see [Async Behavior](../async.md).
