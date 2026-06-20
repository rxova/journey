---
id: graph
title: Graph
sidebar_label: Graph
---

# Graph

Reach for graph mode when "next" stops meaning one thing. Here you declare, per step, which events
lead where — with guards deciding between candidates and `updateContext` deriving new state as part
of the move. The path stays explicit and reviewable, because the routing rules live on the
transitions instead of scattered across button handlers.

:::info Good fit
Verification flows, approval pipelines, support tooling, anything with retries or recovery paths —
flows where the next step depends on what just happened.
:::

## Define a graph journey

The builder, `createGraphJourneyBuilder`, is the recommended way in. It infers types across steps,
guards, and event payloads, and reads like a decision tree:

```ts
import { createGraphJourneyBuilder, createGraphJourney } from "@rxova/journey-core";

type StepId = "login" | "setup2fa" | "verify" | "loggedIn" | "blocked";
type Context = { role: "admin" | "user" | null; attempts: number };
type Events = {
  submit: undefined;
  verifySuccess: undefined;
  verifyFailure: undefined;
};

const { createStep, to, build } = createGraphJourneyBuilder<Context, StepId, Events>();

const machine = createGraphJourney(
  build({
    initial: "login",
    context: { role: null, attempts: 0 },
    steps: [
      createStep("login", {
        on: {
          submit: [to("setup2fa").when(({ context }) => context.role === "admin"), to("verify")]
        }
      }),
      createStep("setup2fa", {
        on: { submit: [to("verify")] }
      }),
      createStep("verify", {
        on: {
          verifySuccess: [to("loggedIn")],
          verifyFailure: [
            to("blocked").when(({ context }) => context.attempts >= 2),
            to("verify").updateContext(({ context }) => ({
              ...context,
              attempts: context.attempts + 1
            }))
          ]
        }
      }),
      createStep("loggedIn", {}),
      createStep("blocked", {})
    ]
  })
);

await machine.startJourney();
```

Read the `verifyFailure` handler top to bottom: it's an ordered list of candidates, and the **first
one whose guard passes wins**. After two failures you're blocked; otherwise you loop back to
`verify` with the attempt count bumped.

### Without the builder

If you'd rather author a plain object, pass a `GraphJourneyDefinition` directly. Here `transitions`
is required and must be an object map:

```ts
import { createGraphJourney, type GraphJourneyDefinition } from "@rxova/journey-core";

type StepId = "start" | "review" | "done";
type Context = { approved: boolean };

const def: GraphJourneyDefinition<Context, StepId> = {
  initial: "start",
  context: { approved: false },
  steps: { start: {}, review: {}, done: {} },
  transitions: {
    start: { goToNextStep: [{ to: "review" }] },
    review: {
      goToNextStep: [{ to: "done", when: ({ context }) => context.approved }, { to: "review" }]
    }
  }
};

const machine = createGraphJourney(def);
```

The builder and the plain form compile to the same thing — the builder just buys you inference and a
fluent API. [Transitions syntax](/docs/core/api/transitions-syntax) covers the object shapes in full.

## Sending events

Custom events are the graph's differentiator. Send them by name, with an optional typed payload:

```ts
await machine.send({ type: "submit" });
await machine.send({ type: "verifySuccess" });

// With a payload
await machine.send({ type: "applyCoupon", payload: { code: "SAVE20" } });
```

:::tip
`send()` resolves with a `JourneySendResult` — `transitioned`, `snapshot`, and `error`. When a move
can fail (a guard that rejects, an async check that throws), check the result rather than assuming it
went through.
:::

## Guards decide; updates derive

A transition has two jobs. The **guard** (`when`) decides whether the move is allowed — it can be
async:

```ts
to("review").when(async ({ context, signal }) => {
  const result = await api.validate(context.formData, { signal });
  return result.valid;
});
```

The **update** (`updateContext`) derives the next context once the move is chosen — it's synchronous:

```ts
to("review").updateContext(({ context, event }) => ({
  ...context,
  couponCode: event.payload?.code ?? null
}));
```

That split is deliberate, and the [Async behavior](/docs/core/async) page goes deep on why and on
timeouts, errors, and retries. The short version:

:::warning
If an async guard throws or times out, the step moves to the `error` phase and `send()` resolves with
`transitioned: false`. Re-send the same event to retry from a clean slate.
:::

## Global transitions

Some events should be handled from any step — a "close" affordance, a help overlay, an abort. Declare
them once under the `global` key instead of repeating them on every step:

```ts
// With the builder
createStep("global" as StepId, {
  on: { requestClose: [to("confirmExit")] }
});

// Or in a plain definition
transitions: {
  global: {
    requestClose: [{ to: "confirmExit" }];
  }
}
```

A step's own transitions for an event take precedence; `global` acts as the fallback when no local
transition matches.

## Built-in navigation still works

Graph mode keeps all the built-ins:

```ts
await machine.goToPreviousStep(); // history pointer navigation
await machine.goToLastVisitedStep(); // back to the realized tail
await machine.completeJourney();
await machine.terminateJourney();
```

`goToNextStep` fires the `goToNextStep` event through your transition graph. If nothing matches and
`requireExplicitCompletion` isn't set, the machine auto-completes.

## A complete flow

```ts
import { createGraphJourneyBuilder, createGraphJourney } from "@rxova/journey-core";

type StepId = "draft" | "review" | "approved" | "rejected";
type Context = { score: number; reviewerId: string | null };
type Events = { submit: undefined; approve: undefined; reject: undefined; revise: undefined };

const { createStep, to, build } = createGraphJourneyBuilder<Context, StepId, Events>();

const machine = createGraphJourney(
  build({
    initial: "draft",
    context: { score: 0, reviewerId: null },
    steps: [
      createStep("draft", { on: { submit: [to("review")] } }),
      createStep("review", {
        on: {
          approve: [to("approved")],
          reject: [to("rejected")],
          revise: [to("draft")]
        }
      }),
      createStep("approved", {}),
      createStep("rejected", { on: { revise: [to("draft")] } })
    ]
  })
);

await machine.startJourney();
await machine.send({ type: "submit" });
await machine.send({ type: "approve" });

machine.getSnapshot().currentStepId; // "approved"
```

## Where to next

- [Async behavior](/docs/core/async) — guards, timeouts, and error handling in depth.
- [Headless](./headless) — when navigation should move out of the flow entirely.
- [Graph builder](/docs/core/api/graph-builder) — the builder API, in full.
