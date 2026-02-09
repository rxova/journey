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
  to: "confirmExit",
  when: ({ context }) => context.dirty
},
{
  from: "*",
  event: "close",
  to: FLOW_TERMINAL.CLOSE,
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
  to: FLOW_TERMINAL.COMPLETE
}
```

## Restart Flow Cleanly

```tsx
const { api } = useFlow<MyContext, MyStepId>();
api.reset();
```

## Observe Flow Changes (Analytics Hook)

```ts
const machine = createFlowMachine(flow);
const unsubscribe = machine.subscribe(() => {
  const snapshot = machine.getSnapshot();
  track("flow_step_changed", {
    current: snapshot.current,
    terminal: snapshot.terminal
  });
});
```

## Persist and Resume

```tsx
const flow = { ... };

<FlowProvider
  flow={flow}
  persistence={{
    key: "checkout-flow",
    version: 2,
    migrate: (snapshot, persistedVersion) => {
      if (persistedVersion === 1) {
        const old = snapshot as { context?: { draftId?: string } };
        return {
          current: "details",
          context: { draftId: old.context?.draftId ?? null, acceptedTerms: false },
          history: ["start"],
          terminal: null
        };
      }
      return snapshot as {
        current: "start" | "details" | "review";
        context: { draftId: string | null; acceptedTerms: boolean };
        history: Array<"start" | "details" | "review">;
        terminal: "COMPLETE" | "CLOSE" | null;
      };
    }
  }}
>
  <FlowStepRenderer />
</FlowProvider>;
```
