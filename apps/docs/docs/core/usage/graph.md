---
id: graph
title: Graph
sidebar_label: Graph
---

# Graph

`createGraphJourney` creates a machine where transitions are declared as an event-keyed map. Each step declares which events it handles and where each one leads. Guards control which transition fires; `updateContext` runs synchronously once a transition is selected.

:::info Good fit
Verification flows, approval pipelines, support tooling, flows with retries or recovery paths, any flow where "next" means different things depending on state.
:::

## Define a Graph Journey

The recommended way is `createGraphJourneyBuilder`. It gives you full type inference across steps, guards, and event payloads with a composable fluent API.

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
            to("blocked")
              .when(({ context }) => context.attempts >= 2)
              .updateContext(({ context }) => ({ ...context, attempts: context.attempts + 1 })),
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

### Using a plain `GraphJourneyDefinition`

If you prefer the plain object form (no builder), pass a `GraphJourneyDefinition` directly. `transitions` is required and must be an object map:

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

## Sending Events

```ts
await machine.send({ type: "submit" });
await machine.send({ type: "verifySuccess" });

// With payload
type Events = { apply: { couponCode: string } };
await machine.send({ type: "apply", payload: { couponCode: "SAVE20" } });
```

:::tip
`send()` returns a `JourneySendResult` with `transitioned`, `snapshot`, and `error`. Always check the result when the transition may fail.
:::

## Guards

Guards are async-capable predicates that control whether a transition fires:

```ts
to("review").when(async ({ context, event }) => {
  const result = await api.validate(context.formData);
  return result.valid;
});
```

:::warning
If an async guard throws or times out, the step moves to `error` phase and `send()` resolves with `transitioned: false`. Re-send the event to retry.
:::

## `updateContext` In Transitions

Context updates that belong to a transition should live inside `updateContext`, not in UI handlers:

```ts
to("review").updateContext(({ context, event }) => ({
  ...context,
  couponCode: event.payload?.couponCode ?? null
}));
```

`updateContext` runs synchronously after guard resolution and before the snapshot commits.

## Global Transitions

Use the `global` step key for events that should be handled regardless of which step is active:

```ts
// In the builder
createStep("global" as StepId, {
  on: {
    requestClose: [to("confirmExit")]
  }
});

// Or in plain definition
transitions: {
  global: {
    requestClose: [{ to: "confirmExit" }];
  }
}
```

## Navigation Fallbacks

Built-in events still work in graph mode:

```ts
await machine.goToPreviousStep(); // history pointer navigation
await machine.goToLastVisitedStep(); // return to current tail
await machine.completeJourney();
await machine.terminateJourney();
```

`goToNextStep` fires the `goToNextStep` event through the transition graph. If no transition matches and `requireExplicitCompletion` is not set, the machine auto-completes.

## Full Example

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

console.log(machine.getSnapshot().currentStepId); // "approved"
```
