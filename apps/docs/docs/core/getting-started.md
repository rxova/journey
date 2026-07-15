---
id: getting-started
title: Quickstart
---

# Quickstart

This page builds a typed linear journey, starts it, observes it, and completes it.

## Install

```bash
pnpm add @rxova/journey-core
```

## Define a flow

```ts
import { createLinearJourney } from "@rxova/journey-core";

type CheckoutStepId = "account" | "shipping" | "review";
type CheckoutContext = { email: string; country: string };
type CheckoutTerminationPayloads = {
  complete: { orderId: string };
  terminate: { reason: "cancelled" };
};

const checkout = createLinearJourney<CheckoutStepId, CheckoutContext, CheckoutTerminationPayloads>({
  steps: [
    { id: "account", metadata: { title: "Account" } },
    { id: "shipping", metadata: { title: "Shipping" } },
    { id: "review", metadata: { title: "Review" } }
  ] as const,
  context: {
    email: "",
    country: ""
  }
});
```

String steps are valid shorthand when a step has no metadata or hooks:

```ts
const compact = createLinearJourney({
  steps: ["account", "shipping", "review"] as const,
  context: { email: "", country: "" }
});
```

## Start and drive it

Machines start with `status: "idle"`. Starting is synchronous; an async initial `onEnter` may
continue after `start()` returns.

```ts
checkout.controls.start();

function waitUntilSettled(machine: typeof checkout): Promise<void> {
  if (!machine.getSnapshot().transition.pending) return Promise.resolve();

  return new Promise((resolve) => {
    const stop = machine.subscriptions.subscribeSelector(
      (snapshot) => snapshot.transition.pending,
      (pending) => {
        if (!pending) {
          stop();
          resolve();
        }
      }
    );
  });
}

await waitUntilSettled(checkout);

checkout.context.update((context) => ({
  ...context,
  email: "ada@example.com"
}));

const result = await checkout.navigate.goToNextStep();

if (!result.ok) {
  console.error(result.reason);
}
```

Every navigation method resolves to a `NavigationResult`:

```ts
type NavigationResult<StepId extends string> =
  | { ok: true; from: StepId | null; to: StepId }
  | { ok: false; reason: NavigationFailureReason; error?: unknown };
```

Use `snapshot.machine.isLoading` as the default flag for disabling UI controls while navigation
work or lifecycle effects settle.

## Read the snapshot

```ts
const snapshot = checkout.getSnapshot();

snapshot.type; // "linear"
snapshot.status; // "running"
snapshot.currentStep?.id; // "shipping"
snapshot.currentStep?.metadata.title; // "Shipping"
snapshot.currentStep?.index; // 1
snapshot.history.timeline; // ["account", "shipping"]
snapshot.machine.isLoading; // false
snapshot.steps.totalSteps; // 3
```

## Subscribe

Subscriptions are grouped under `machine.subscriptions`.

```ts
const stopStepSubscription = checkout.subscriptions.subscribeSelector(
  (snapshot) => snapshot.currentStep?.id,
  (stepId) => renderStep(stepId)
);

const stopErrors = checkout.subscriptions.subscribeEvent("error", ({ error, phase }) => {
  reportError(error, phase);
});
```

Selectors run when their selected value changes. `subscribeEvent` listens to one named event and
returns an unsubscribe function.

## Complete and restart

```ts
await checkout.navigate.goToNextStep();
checkout.controls.complete({ orderId: "order-42" });

checkout.getSnapshot().machine.outcome;
// { type: "completed", payload: { orderId: "order-42" } }

checkout.controls.restart();
```

`restart()` is accepted only from `completed` or `terminated`. It restores the initial context,
clears history and outcome, and enters the initial step again.

Reaching `review` did not complete the journey automatically. The last screen is a position;
`controls.complete()` records the separate product outcome. The optional third factory generic
above makes both terminal control payloads and `snapshot.machine.outcome` type-safe.

Call `checkout.dispose()` when the runtime is no longer needed.

## Where to next

- [Linear journeys](./usage/linear) covers every linear navigation rule.
- [Graph journeys](./usage/graph) adds typed events, guards, and branching.
- [Snapshot](./snapshot) documents the complete read model.
- [Machine API](./api/machine-api) lists every method and result.
