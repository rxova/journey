---
title: "Recipes"
---

Recipes are the shortest path to “how do I do this in a real flow?”

## Use Previous-Step Navigation By Default

```ts
await machine.goToPreviousStep();
```

Use the built-in previous-step helper when product behavior really means "move the history pointer backward".

## Override `back` When Product Rules Need It

```ts
const journey = {
  transitions: {
    review: {
      back: [{ to: "confirmExit", id: "review-confirm-exit" }]
    }
  }
};
```

Use this when “back” is not really “go to previous history item”, but a deliberate branch in the flow.

## Skip A Step Without Hiding The Rule In The UI

```ts
const journey = {
  transitions: {
    details: {
      goToNextStep: [
        {
          id: "details-skip-payment",
          to: "review",
          when: ({ context }) => context.isVip
        }
      ]
    }
  }
};
```

This keeps the skip rule with the transition instead of burying it inside button logic.

## Update Context As Part Of A Transition

```ts
const journey = {
  transitions: {
    payment: {
      applyCoupon: [
        {
          id: "payment-review",
          to: "review",
          updateContext: ({ context, event }) => ({
            ...context,
            couponCode: event.payload?.code ?? null
          })
        }
      ]
    }
  }
};
```

Use transition `updateContext` when the context change belongs to the transition itself.

## Add A Timeout To Async Work

```ts
const journey = {
  transitions: {
    verify: {
      goToNextStep: [
        {
          id: "verify-approved",
          to: "approved",
          timeoutMs: 3_000,
          when: async ({ context }) => (context.score ?? 0) >= 80
        }
      ]
    }
  }
};
```

Timeouts are useful when a stalled async guard should fail cleanly instead of leaving the caller waiting forever.

## Jump Back More Than One Step

```ts
await machine.goToPreviousStep(3);
```

This moves the history pointer backward without rewriting visited state.

## Return To The Current Tail

```ts
await machine.goToLastVisitedStep();
```

Use this when the user inspected an earlier point in history and should return to the most recently realized step.

## Read Step Metadata

```ts
const meta = machine.getStepMeta("details");
console.log(meta?.title);
```

This is useful for reading UI-facing per-step definition data without mixing it into mutable runtime context.

## Observe Lifecycle Events

```ts
const unsubscribe = machine.subscribeEvent((event) => {
  if (event.type === "transition.error") {
    console.error(event.transitionId, event.error);
  }
});
```

Use lifecycle events when you care about how the flow changed, not just what the current snapshot is.

## Handle Async Transition Errors

When a guard or `updateContext` fails, Journey moves the source step into `error` phase and resolves `send()` with `transitioned: false`.

### Retry by re-sending the same event

Re-sending the event is all that is needed to retry. Journey clears the error phase and restarts the transition pipeline from the beginning.

```ts
const result = await machine.goToNextStep();

if (!result.transitioned && result.error) {
  // surface result.error to the UI — let the user retry
  // calling goToNextStep() again will start a fresh attempt
}
```

### Dismiss without retrying

Use `clearStepError()` when the user wants to cancel the failed operation and return the step to its normal interactive state without triggering a new transition.

```ts
// Resets the current step's async phase from "error" back to "idle"
machine.clearStepError();

// Or target a specific step
machine.clearStepError("payment");
```

### Read the error in UI

`snapshot.async.byStep[stepId].error` holds the thrown value from the failed guard or `updateContext`. Use it to show a contextual message.

```ts
const asyncState = snapshot.async.byStep[snapshot.currentStepId];

if (asyncState.phase === "error") {
  return (
    <ErrorPanel
      message={asyncState.error instanceof Error ? asyncState.error.message : "Something went wrong"}
      onRetry={() => machine.goToNextStep()}
      onDismiss={() => machine.clearStepError()}
    />
  );
}
```

### Branch on error via a fallback transition

If certain failures should navigate the user to a different step rather than retrying, use an additional transition with a `when` guard that inspects context set before the failure:

```ts
// On error: update context with failure info, then send a recovery event
const result = await machine.goToNextStep();
if (!result.transitioned && result.error) {
  machine.updateContext((ctx) => ({ ...ctx, submitError: result.error }));
  await machine.send({ type: "handleError" });
}

// In the journey definition:
transitions: {
  payment: {
    handleError: [
      { to: "errorFallback", when: ({ context }) => context.submitError != null },
      { to: "review" }
    ];
  }
}
```

## Build Ordered Branches

```ts
const journey = {
  transitions: {
    details: {
      goToNextStep: [
        {
          id: "details-extra",
          to: "extra",
          when: ({ context }) => context.includeExtra
        },
        {
          id: "details-review",
          to: "review"
        }
      ]
    }
  }
};
```

Use ordered event arrays when a branch wants to read like a decision tree but the runtime still needs a simple first-match-wins model.
