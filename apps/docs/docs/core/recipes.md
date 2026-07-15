---
id: recipes
title: Recipes
---

# Recipes

## Validate before moving forward

```ts
const result = await machine.navigate.goToNextStep({
  run: async ({ snapshot }) => {
    const errors = await validate(snapshot.context);
    if (errors.length > 0) throw new ValidationError(errors);
    return { validatedAt: Date.now() };
  },
  commit: ({ result, updateContext }) => {
    updateContext((context) => ({ ...context, validatedAt: result.validatedAt }));
  }
});
```

If validation fails, the machine remains on the current step and staged context is not published.

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

## Retry failed navigation work

```ts
const result = await machine.navigate.goToNextStep(work);

if (!result.ok && result.reason === "error") {
  showValidation(result.error);
  // Retry with the same work after the user fixes the input.
}
```

Failures are represented by the result, `navigationBlocked`, and `error` events. They also live on
`snapshot.currentStep.async`; call `machine.async.clearError()` to clear the snapshot error.

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
