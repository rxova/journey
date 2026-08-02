---
title: "Immer connector"
---

The Immer connector turns an Immer producer into the same `ContextUpdater` accepted throughout
Core. It is useful when nested immutable updates would otherwise require several object and array
spreads.

## Install and import

Immer is an optional peer rather than part of the base Core installation:

```bash
pnpm add immer
```

Import the connector from its dedicated entry point:

```ts
import { immerConnector } from "@rxova/journey-core/connectors/immer";
```

Importing `@rxova/journey-core` does not load or re-export Immer.

## Update nested context

Give the connector the journey's context type. Inside the recipe, Immer exposes a writable draft
while leaving the previously published context untouched:

```ts
type CheckoutContext = {
  cart: {
    items: { sku: string; quantity: number }[];
    total: number;
  };
  coupon: string | null;
};

machine.context.update(
  immerConnector<CheckoutContext>((draft) => {
    draft.cart.items[0]!.quantity += 1;
    draft.cart.total += 12;
    draft.coupon = null;
  })
);
```

Only changed branches receive new references. Unchanged branches retain their existing references,
which keeps selector equality and memoized rendering useful.

## Use it anywhere `updateContext` appears

The connector returns a normal Core updater, so the same form works in step hooks, transition
effects, and transactional work commits:

```ts
commit: ({ result, updateContext }) => {
  updateContext(
    immerConnector<CheckoutContext>((draft) => {
      draft.cart.total = result.total;
    })
  );
};
```

In transactional work, Immer changes are still staged by Journey. If routing fails or the operation
is superseded, Core discards the staged context exactly as it would with a spread-based updater.

## Replace the context

Recipes follow Immer's producer rules. They may mutate the draft or return a complete replacement,
but must not do both:

```ts
machine.context.update(
  immerConnector<CheckoutContext>(() => ({
    cart: { items: [], total: 0 },
    coupon: null
  }))
);
```

Returning `undefined` without mutations means no change. If the context type itself allows
`undefined` and that is the intended replacement, return Immer's `nothing` sentinel.

## Immer behavior still applies

- Recipes are synchronous. Await external work in Journey's `run` phase and apply its result in the
  synchronous `commit` phase.
- Plain objects and arrays are draftable by default. Maps, sets, and custom classes follow Immer's
  own configuration rules.
- Immer auto-freezes produced values by default. Configure Immer in application startup if a
  different policy is required.
- A shared optional peer ensures the connector observes the same Immer configuration as application
  code.

The connector does not make context serializable. Keep functions, DOM objects, and other
transport-specific values out of context when using persistence, replay export, or DevTools.
