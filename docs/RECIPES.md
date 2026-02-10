# Recipes

## Skip Optional Step

```ts
{
  from: "details",
  event: "next",
  to: "optional",
  when: ({ context }) => context.needsOptional
},
{
  from: "details",
  event: "next",
  to: "review",
  when: ({ context }) => !context.needsOptional
}
```

## Confirm Close Modal

```ts
{
  from: "*",
  event: "close",
  to: "confirmClose",
  when: ({ context }) => context.dirty
},
{
  from: "*",
  event: "close",
  to: JOURNEY_TERMINAL.CLOSE,
  when: ({ context }) => !context.dirty
}
```

## Custom Event

```ts
type Event = "next" | "back" | "close" | "submit" | "retry";

{
  from: "error",
  event: "retry",
  to: "details"
}
```

```tsx
api.send({ type: "retry" });
```

## Async Guard

```ts
{
  from: "payment",
  event: "next",
  to: "review",
  when: async ({ context }) => validatePayment(context)
}
```

## Show Loading And Error Per Step

```tsx
const { snapshot, api } = useJourney<MyCtx, MyStepId>();
const asyncState = snapshot.async.byStep[snapshot.current];

const isBusy = asyncState.phase === "evaluating-when" || asyncState.phase === "running-effect";

if (isBusy) {
  return <p>Loading...</p>;
}

if (asyncState.phase === "error") {
  return (
    <div>
      <p>Something failed.</p>
      <button onClick={() => api.clearStepError()}>Dismiss</button>
      <button onClick={() => api.next()}>Retry</button>
    </div>
  );
}
```

## Guard That Throws (and how to handle it)

```ts
{
  from: "payment",
  event: "next",
  to: "review",
  when: async ({ context }) => {
    const ok = await verifyPayment(context.paymentId);
    if (!ok) {
      throw new Error("Payment verification failed");
    }
    return true;
  }
}
```

```tsx
try {
  await api.next();
} catch {
  // optional extra handling (toast/logging), snapshot.async already captures error
}
```

## Async Effect

```ts
{
  from: "details",
  event: "next",
  to: "review",
  effect: async ({ context }) => {
    const draftId = await saveDraft(context);
    return { ...context, draftId };
  }
}
```

## Effect That Throws (server save failed)

```ts
{
  from: "details",
  event: "next",
  to: "review",
  effect: async ({ context }) => {
    const res = await saveDraft(context);
    if (!res.ok) {
      throw new Error("Could not save draft");
    }
    return { ...context, draftId: res.id };
  }
}
```

## Programmatic Jump

```tsx
api.goTo("review");
```

## Use History-Based Back

```ts
{ from: "*", event: "back", to: HISTORY_TARGET }
```

## Branch on API Result

```ts
{
  from: "verify",
  event: "next",
  to: "manualReview",
  when: async ({ context }) => {
    const res = await checkFraud(context.orderId);
    return res.score > 70;
  }
},
{
  from: "verify",
  event: "next",
  to: "payment",
  when: async ({ context }) => {
    const res = await checkFraud(context.orderId);
    return res.score <= 70;
  }
}
```

## Save Draft Then Continue

```ts
{
  from: "shipping",
  event: "next",
  to: "review",
  effect: async ({ context }) => {
    const saved = await saveDraft(context);
    return {
      ...context,
      draftId: saved.id
    };
  }
}
```

## Force Final Confirmation Before Submit

```ts
{
  from: "review",
  event: "submit",
  to: "confirmSubmit"
},
{
  from: "confirmSubmit",
  event: "submit",
  to: JOURNEY_TERMINAL.COMPLETE
}
```

## Restart Flow Cleanly

```tsx
const { api } = useJourney<MyContext, MyStepId>();
api.reset();
```

## Observe Flow Changes (Analytics Hook)

```ts
const machine = createJourneyMachine(journey);
const unsubscribe = machine.subscribe(() => {
  const snapshot = machine.getSnapshot();
  track("flow_step_changed", {
    current: snapshot.current,
    status: snapshot.status
  });
});
```

## Persist and Resume

```tsx
const journey = { ... };

<JourneyProvider
  journey={journey}
  persistence={{
    key: "checkout-journey",
    version: 2,
    migrate: (snapshot, persistedVersion) => {
      if (persistedVersion === 1) {
        const old = snapshot as { context?: { draftId?: string } };
        return {
          current: "details",
          context: { draftId: old.context?.draftId ?? null, acceptedTerms: false },
          history: ["start"],
          status: "running"
        };
      }
      return snapshot as {
        current: "start" | "details" | "review";
        context: { draftId: string | null; acceptedTerms: boolean };
        history: Array<"start" | "details" | "review">;
        status: "running" | "complete" | "closed";
      };
    }
  }}
>
  <JourneyStepRenderer />
</JourneyProvider>;
```

Async compatibility note:

- `snapshot.async` is not persisted.
- after hydrate/reset, async phases start as `idle` and previous runtime errors are cleared.
