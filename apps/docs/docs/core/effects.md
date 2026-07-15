---
id: effects
title: Effects
---

# Effects

V1 models side effects with step hooks and graph transition hooks. There is no separate `effect`
object or delayed `after` transition.

## Work before a move

Use `onLeave` when work must decide whether navigation may commit:

```ts
{
  id: "payment",
  onLeave: async ({ snapshot, updateContext }) => {
    const result = await authorize(snapshot.context.cardToken);
    updateContext((context) => ({ ...context, authorizationId: result.id }));
    return result.approved;
  }
}
```

Returning `false` blocks. Throwing or timing out returns a navigation failure with reason `"error"`.

## Work after a move

Use step `onEnter` for destination work:

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
SUBMIT: {
  from: "review",
  to: "done",
  onTransition: async ({ event }) => {
    await auditSubmission(event?.payload);
  }
}
```

Post-commit failures do not roll navigation back. They set the destination step's async error and
emit the `error` subscription event.

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
