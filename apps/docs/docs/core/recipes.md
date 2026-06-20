---
id: recipes
title: Recipes
sidebar_label: Recipes
---

# Recipes

Short answers to "how do I do this in an actual flow?" Each recipe is a small, copyable pattern. If
a term is unfamiliar, [Core concepts](/docs/core/concepts) has the background.

## Navigation

### Step back through history

```ts
await machine.goToPreviousStep(); // one step
await machine.goToPreviousStep(3); // three steps
```

This moves the history pointer backward without rewriting `visited` — going back to look at an
earlier step doesn't erase the fact that a later one happened.

### Return to where the user left off

```ts
await machine.goToLastVisitedStep();
```

Use this when the user stepped back to inspect an earlier point and now wants to jump forward to the
most recent step they'd reached.

### Make "back" a deliberate branch

When "back" should mean something richer than "previous history item" — say, a confirm-before-exit
prompt — declare it as its own transition instead of relying on the pointer:

```ts
transitions: {
  review: {
    back: [{ to: "confirmExit", id: "review-confirm-exit" }];
  }
}
```

`back` isn't a built-in event, so this only fires when you've declared a matching transition. See
[Timeline & history](/docs/core/history#back-is-not-a-built-in-event) for how this interacts with the
built-in fallback.

## Branching and context

### Skip a step without hiding the rule in the UI

```ts
transitions: {
  details: {
    goToNextStep: [
      { id: "details-skip-payment", to: "review", when: ({ context }) => context.isVip }
    ];
  }
}
```

The skip rule lives on the transition, where a reviewer can see it — not buried inside a button's
click handler.

### Build ordered branches that read like a decision tree

```ts
transitions: {
  details: {
    goToNextStep: [
      { id: "details-extra", to: "extra", when: ({ context }) => context.includeExtra },
      { id: "details-review", to: "review" }
    ];
  }
}
```

Candidates are tried in order, first match wins. Order them like a decision tree and the runtime
keeps the simple first-match-wins model.

### Update context as part of a transition

```ts
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
    ];
  }
}
```

When a context change belongs to a move, put it in the transition's `updateContext` rather than
calling `updateContext()` separately from the UI.

## Async and errors

### Cap async work with a timeout

```ts
transitions: {
  verify: {
    goToNextStep: [
      {
        id: "verify-approved",
        to: "approved",
        timeoutMs: 3_000,
        when: async ({ context }) => (context.score ?? 0) >= 80
      }
    ];
  }
}
```

A stalled guard should fail cleanly instead of leaving the caller waiting forever.

### Retry a failed transition

When a guard or `updateContext` fails, the source step moves to the `error` phase and `send()`
resolves with `transitioned: false`. Re-sending the same event is the entire retry — Journey clears
the error and runs the transition from the top:

```ts
const result = await machine.goToNextStep();

if (!result.transitioned && result.error) {
  // surface result.error, then let the user trigger goToNextStep() again
}
```

### Dismiss a failure without retrying

```ts
machine.clearStepError(); // current step back to "idle"
machine.clearStepError("payment"); // or a specific step
```

Use this when the user cancels a failed operation and you want the step interactive again without
starting a new transition.

### Render the error

`snapshot.async.byStep[stepId].error` holds whatever the failed guard or update threw:

```tsx
const asyncState = snapshot.async.byStep[snapshot.currentStepId];

if (asyncState.phase === "error") {
  return (
    <ErrorPanel
      message={
        asyncState.error instanceof Error ? asyncState.error.message : "Something went wrong"
      }
      onRetry={() => machine.goToNextStep()}
      onDismiss={() => machine.clearStepError()}
    />
  );
}
```

### Branch to a recovery step on failure

If certain failures should route somewhere instead of retrying, stash the error in context and send a
recovery event:

```ts
const result = await machine.goToNextStep();
if (!result.transitioned && result.error) {
  machine.updateContext((ctx) => ({ ...ctx, submitError: result.error }));
  await machine.send({ type: "handleError" });
}
```

```ts
transitions: {
  payment: {
    handleError: [
      { to: "errorFallback", when: ({ context }) => context.submitError != null },
      { to: "review" }
    ];
  }
}
```

## Observation

### Read per-step metadata for the UI

```ts
const meta = machine.getStepMeta("details");
meta?.title;
```

Static, UI-facing data stays in step metadata instead of mixing into mutable runtime context.

### Watch lifecycle events

```ts
const unsubscribe = machine.subscribeEvent((event) => {
  if (event.type === "transition.error") {
    console.error(event.transitionId, event.error);
  }
});
```

Reach for lifecycle events when you care about how the flow changed over time, not just the current
snapshot.

## Where to next

- [Async behavior](/docs/core/async) — the full model behind guards, timeouts, and errors.
- [Examples](./examples) — complete, runnable apps for each mode.
- [Plugins](/docs/core/plugins/overview) — persistence, autosave, analytics, and more.
