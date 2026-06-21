---
id: coming-from-xstate
title: Coming from XState
sidebar_label: Coming from XState
---

# Coming from XState

If you've used XState, Journey will feel familiar — guards, context, transitions, async work on
entry — but aimed squarely at **product flows** rather than general statecharts. This page maps the
concepts and shows where Journey trades surface area for ergonomics.

## The headline: effects vs. `invoke`

The most common flow pattern is "load on entry, branch on the result." Here's the same machine in
both libraries.

**XState v5:**

```ts
import { setup, assign, fromPromise } from "xstate";

const machine = setup({
  types: { context: {} as { id: string; user: User | null; error: string | null } },
  actors: {
    loadUser: fromPromise(({ input }: { input: { id: string } }) => api.user(input.id))
  }
}).createMachine({
  initial: "loading",
  context: { id: "", user: null, error: null },
  states: {
    loading: {
      invoke: {
        src: "loadUser",
        input: ({ context }) => ({ id: context.id }),
        onDone: { target: "ready", actions: assign({ user: ({ event }) => event.output }) },
        onError: {
          target: "failed",
          actions: assign({ error: ({ event }) => String(event.error) })
        }
      }
    },
    ready: {},
    failed: {}
  }
});
```

**Journey:**

```ts
import { createGraphJourneyBuilder, createGraphJourney } from "@rxova/journey-core";

const { createStep, build } = createGraphJourneyBuilder<{
  context: Context;
  stepId: StepId;
  events: Events;
  meta: unknown;
  handlers: Handlers;
}>();

const machine = createGraphJourney(
  build({
    initial: "loading",
    context: { id: "", user: null, error: null },
    handlers: { loadUser: (id: string) => api.user(id) },
    steps: [
      createStep("loading", {
        effect: {
          run: ({ context, handlers }) => handlers.loadUser(context.id),
          onResolved: {
            to: "ready",
            updateContext: ({ context, output }) => ({ ...context, user: output })
          },
          onRejected: {
            to: "failed",
            updateContext: ({ context, error }) => ({ ...context, error: String(error) })
          }
        }
      }),
      createStep("ready", {}),
      createStep("failed", {})
    ]
  })
);
```

What changed:

- **No actor registration.** No `setup({ actors })`, no string `src`, no `input` mapping function —
  the work is inline on the step.
- **`output` is inferred.** It's the return type of `run`; no `event.output`, no `assertEvent`, no
  cast.
- **Targets are inferred step ids.** `to: "ready"` is checked against your `StepId` union.

See [Effects](/docs/core/effects) for the full API.

## Concept map

| XState v5                    | Journey                                                          |
| ---------------------------- | ---------------------------------------------------------------- |
| `createMachine` / `states`   | a journey definition / `steps`                                   |
| `context` (typed in `setup`) | `TContext` generic (inferred from your definition)               |
| events (discriminated union) | `TEventMap` (payloads narrowed via the builder's factory form)   |
| `invoke` + `fromPromise`     | a step [effect](/docs/core/effects) (`effect.run`)               |
| `onDone` / `onError`         | `onResolved` / `onRejected`                                      |
| `after` (delayed transition) | a step's [`after`](/docs/core/effects#delayed-transitions-after) |
| `assign(...)`                | a transition's [`updateContext`](/docs/core/async)               |
| guards (named in `setup`)    | [`when`](/docs/core/usage/graph) (inline, inferred)              |
| `and` / `or` / `not`         | ordered candidates, first match wins                             |
| entry / exit actions         | step `onEnter` / `onLeave` (which can `dispatch` to chain)       |
| `actor.send`                 | `machine.send`                                                   |
| `actor.subscribe` / snapshot | `subscribe` / `getSnapshot` (one serializable snapshot)          |

## Where Journey is stronger

- **Authoring + types.** The builder co-locates transitions with steps, makes each modifier
  single-use at the type level, and infers payloads and effect output — none of `setup()`'s
  string-keyed registration or hand-annotated action/guard params.
- **One read model.** A single serializable snapshot carries the step, the **realized history
  timeline**, context, visited map, status, and per-step async phase. History is the path actually
  taken, not a separate "history state" concept.
- **Async is visible.** Guards (`evaluating-when`) and effects (`invoking`) surface a per-step phase
  in the snapshot — render loading directly instead of modeling it as extra states.

## What Journey doesn't do (by design)

Journey is a flow runtime, not a general statechart engine. It intentionally leaves out:

- hierarchical / nested states and parallel regions;
- history states (Journey tracks a realized timeline instead);
- spawned actor networks and `sendTo` / `sendParent` messaging.

If your problem is genuinely a statechart — traffic lights, nested regions, a network of
communicating actors — XState is the right tool. If it's a product flow that branches, gates on
async work, and needs to be inspected and persisted, Journey gives you that with far less ceremony.

## Where to next

- [Effects](/docs/core/effects) — the full effect API.
- [Choosing a mode](/docs/core/usage) — linear, graph, or headless.
- [Comparison](/docs/core/comparison) — feature-by-feature table.
