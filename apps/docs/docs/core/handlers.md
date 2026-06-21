---
id: handlers
title: Handlers
sidebar_label: Handlers
---

# Handlers

A guard, a step effect, or a lifecycle callback almost always needs to call _your_ code — hit an API,
validate a code, check a feature flag. You could `import` those functions straight into your step
definitions, but then the flow is welded to a specific implementation and awkward to test.
**Handlers** are the seam that fixes that: a typed bag of your functions, declared once on the
definition and handed to every guard, effect, and lifecycle callback as an argument.

It's dependency injection for a flow — keep your I/O in `handlers`, call it from the step, and swap
it wholesale in a test.

## Declare them, then call them

Put your functions under `handlers` on the definition (or `build({ handlers })` with the builder).
They arrive on the args object as `handlers`:

```ts
import { createGraphJourney, createGraphJourneyBuilder } from "@rxova/journey-core";

type Context = { token: string; plan: string | null };
type StepId = "verify" | "approved" | "blocked";

const { createStep, build } = createGraphJourneyBuilder<{ context: Context; stepId: StepId }>();

const machine = createGraphJourney(
  build({
    initial: "verify",
    context: { token: "abc", plan: null },
    handlers: {
      // your I/O lives here
      verifyToken: (token: string, opts: { signal: AbortSignal }) => api.verify(token, opts)
    },
    steps: [
      createStep("verify", {
        effect: {
          // …and you call it here, instead of importing `api` directly
          run: ({ context, handlers, signal }) => handlers.verifyToken(context.token, { signal }),
          onResolved: {
            to: "approved",
            updateContext: ({ context, output }) => ({ ...context, plan: output.plan })
          },
          onRejected: { to: "blocked" }
        }
      }),
      createStep("approved", {}),
      createStep("blocked", {})
    ]
  })
);
```

`handlers` is fully typed from what you declared — `handlers.verifyToken` has the exact signature you
wrote, and a typo or wrong argument is a compile error.

## Where `handlers` is available

The runtime reads `handlers` once at creation (defaulting to `{}` if you omit it) and injects it into
the args of the callbacks that run _your_ logic:

| Callback                          | Gets `handlers`?                                                               |
| --------------------------------- | ------------------------------------------------------------------------------ |
| `effect.run`                      | ✅                                                                             |
| `when` (guard)                    | ✅                                                                             |
| `onEnter` / `onLeave` (lifecycle) | ✅                                                                             |
| `updateContext`                   | ⛔ — context updates are pure; derive from `context`/`event`/`output`, not I/O |

```ts
// In a guard:
to("approved").when(({ context, handlers, signal }) =>
  handlers.isEligible(context.userId, { signal })
);

// In a lifecycle callback:
createStep("review", {
  onEnter: ({ context, handlers }) => handlers.track("review_opened", { userId: context.userId })
});
```

:::note Handlers are passive
The machine never calls your handlers for you — _your_ guard/effect/callback code does. Handlers are
a dependency-injection slot, not an event system. The runtime's job is just to hand them to you,
typed, at the right moment.
:::

## Why bother — testability

Because the implementations live in one place and arrive as an argument, a test swaps them without
touching the flow:

```ts
const machine = createGraphJourney(
  build({
    /* …same steps… */
    handlers: { verifyToken: async () => ({ plan: "pro" }) } // fake, no network
  })
);
```

The transitions, guards, and effects are identical; only the injected functions change. No mocking
of modules, no intercepting `fetch`.

## Coming from XState

XState solves the same problem with **named registration**. You register implementations in
`setup({ actors, actions, guards })` and refer to them by **string** in the machine, then override
them with `.provide(...)`:

```ts
// XState v5
const machine = setup({
  actors: { verifyToken: fromPromise(({ input }) => api.verify(input.token)) }
}).createMachine({
  states: {
    verify: {
      invoke: {
        src: "verifyToken",
        input: ({ context }) => ({ token: context.token }),
        onDone: "approved",
        onError: "blocked"
      }
    }
  }
});
// tests:
const test = machine.provide({
  actors: { verifyToken: fromPromise(async () => ({ plan: "pro" })) }
});
```

```ts
// Journey
build({
  handlers: { verifyToken: (token, { signal }) => api.verify(token, { signal }) },
  steps: [
    createStep("verify", {
      effect: {
        run: ({ context, handlers, signal }) =>
          handlers.verifyToken(context.token, { signal }) /* … */
      }
    })
  ]
});
// tests: pass a different `handlers` object.
```

The difference is indirection. XState decouples through **string keys** (`src: "verifyToken"`) and a
separate registry, which is what powers its visualizer and `.provide()`. Journey passes the **actual
function**, so the call is direct and fully inferred — `handlers.verifyToken(...)` with no string to
keep in sync — and you "provide" simply by handing over a different `handlers` object. You trade the
tooling/indirection for inference and fewer moving parts.

## Where to next

- [Effects](/docs/core/effects) — the most common place a handler is called (`effect.run`).
- [Graph](/docs/core/usage/graph) — guards (`when`) that gate on a handler.
- [Coming from XState](/docs/core/coming-from-xstate) — the broader side-by-side.
