---
id: recipes
title: Recipes
---

# Recipes

## Validate before leaving

```ts
const form = {
  id: "form",
  onLeave: async ({ snapshot, updateContext }) => {
    const errors = await validate(snapshot.context);
    updateContext((context) => ({ ...context, errors }));
    return errors.length === 0;
  }
};
```

The context update remains visible if the move is blocked.

## Ordered graph branches

```ts
transitions: {
  CONTINUE: [
    { from: "details", to: "vipReview", when: ({ context }) => context.isVip },
    { from: "details", to: "company", when: ({ context }) => context.isBusiness },
    { from: "details", to: "review" }
  ];
}
```

Put the fallback last. First enabled candidate wins.

## Use typed event payloads

```ts
type Event = { type: "APPLY_COUPON"; payload: { code: string } };

APPLY_COUPON: {
  from: "payment",
  to: "review",
  onTransition: ({ event, updateContext }) => {
    updateContext((context) => ({
      ...context,
      coupon: event?.payload.code ?? null
    }));
  }
}

await machine.send("APPLY_COUPON", { code: "SAVE20" });
```

## Retry a blocked or failed leave

```ts
const result = await machine.navigate.goToNextStep();

if (!result.ok && (result.reason === "blocked" || result.reason === "error")) {
  showValidation(result.error);
  // Retry by calling the same navigation method after the user fixes the input.
}
```

There is no separate error-clear command. Pre-commit failures are represented by the result and
`navigationBlocked` event; post-commit errors live on `snapshot.currentStep.async` until another
entry replaces them.

## Route post-commit work

```ts
const verify = createStep("verify", {
  onEnter: async ({ snapshot, updateContext, raise }) => {
    try {
      const receipt = await charge(snapshot.context.paymentToken);
      updateContext((context) => ({ ...context, receipt }));
      raise({ type: "SUCCEEDED" });
    } catch (error) {
      updateContext((context) => ({ ...context, paymentError: error }));
      raise({ type: "FAILED" });
    }
  },
  on: {
    SUCCEEDED: [to("done")],
    FAILED: [to("payment")]
  }
});
```

## Resume a timeline position in application code

The persistence plugin can read stored state but does not hydrate runtime history. Restore approved
context before creation, start the machine, then navigate according to an application-owned policy:

```ts
machine.controls.start();
await waitUntilSettled(machine);
await machine.navigate.goToStepById(resumeStepId);
```

For graph journeys, that id must be the target of an enabled transition from the current step.
`waitUntilSettled` is defined in the [Quickstart](./getting-started).

## Observe one UI slice

```ts
const stop = machine.subscriptions.subscribeSelector(
  (snapshot) => ({
    step: snapshot.currentStep?.id,
    loading: snapshot.machine.isLoading
  }),
  render,
  (a, b) => a.step === b.step && a.loading === b.loading
);
```

## Observe blocked navigation

```ts
const stop = machine.subscriptions.subscribeEvent(
  "navigationBlocked",
  ({ reason, from, to, error }) => log({ reason, from, to, error })
);
```

## Read current-step metadata

```ts
const title = machine.getSnapshot().currentStep?.metadata.title;
```

Metadata for non-current steps remains in your reusable definition.

## Where to next

- [Async behavior](./async)
- [Machine API](./api/machine-api)
- [Plugins](./plugins/overview)
