---
title: "Effects"
---

V1 models side effects with step hooks and graph transition hooks. There is no separate `effect`
object or delayed `after` transition.

## Transactional work before a move

Pass work to next or previous navigation when it must succeed before movement:

```ts
await machine.navigate.goToNextStep({
  run: async ({ snapshot }) => {
    const authorization = await authorize(snapshot.context.cardToken);
    if (!authorization.approved) throw new Error("Payment declined");
    return authorization;
  },
  commit: ({ result, updateContext }) => {
    updateContext((context) => ({ ...context, authorizationId: result.id }));
  }
});
```

`run` may be asynchronous. `commit` is synchronous and its updates publish atomically with the
step change. A failure leaves both the current step and context unchanged.

`goToNextStep(work?)` is the only place a linear journey takes pre-move async. Backward navigation
and `goToStepById` take none: update the context and then move.

In React, `useStepHandler(stepId, work)` registers the same work for as long as the calling
component is mounted, and the bundle's `goToNextStep()` runs it when no explicit work is passed.

A graph declares its async on the step instead, under the event that triggers it — see
[Transitions syntax](./api/transitions-syntax).

## Work after a move

Use `onLeave` for source cleanup and `onEnter` for destination setup:

```ts
{
  id: "receipt",
  onEnter: async ({ snapshot }) => {
    await sendReceipt(snapshot.context.orderId);
  }
}
```

Use graph `onTransition` when the work belongs to a specific event edge:

```ts
review: {
  on: {
    SUBMIT: [
      {
        to: "done",
        onTransition: async ({ event }) => {
          await auditSubmission(event?.payload);
        }
      }
    ];
  }
}
```

These hooks are awaited in `onLeave` -> `onTransition` -> `onEnter` order. Failures do not roll
navigation back or skip later effects; they set async error state and emit the `error` event.

## Chain graph work with `raise`

Hooks can enqueue a follow-up graph event without re-entering `send` during a pending transition:

```ts
onEnter: ({ raise }) => {
  raise({ type: "LOAD_COMPLETE", payload: { cached: true } });
};
```

Raised events run FIFO after the current move settles. Directly calling `send()` from a pending hook
returns `reason: "transitioning"`.

## Delays

Schedule delayed domain events in application code and dispose the timer with the owning UI or a
custom plugin:

```ts
const timer = setTimeout(() => void machine.send("TIMEOUT"), 10_000);
```

## Where to next

- [Step behavior](./usage/step-behavior)
- [Async behavior](./async)
- [Writing a plugin](./plugins/authoring)
