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
