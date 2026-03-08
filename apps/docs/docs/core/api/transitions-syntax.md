---
title: Transition Syntax
sidebar_label: Transition Syntax
---

Journey supports two equivalent ways to define transitions:

- plain objects
- `tx` helpers

Both produce the same runtime behavior. Transition matching is still deterministic: first valid transition wins.

## Option A: Plain Transition Objects

Use plain objects when you want direct, explicit definitions.

```ts
const transitions = [
  {
    id: "start-next",
    from: "start",
    event: "goToNextStep",
    to: "details"
  },
  {
    id: "details-next-guarded",
    from: "details",
    event: "goToNextStep",
    to: "review",
    when: ({ context }) => context.canContinue
  },
  {
    id: "details-save",
    from: "details",
    event: "goToNextStep",
    to: "review",
    effect: async ({ context }) => {
      const saved = await saveDraft(context);
      return { ...context, draftId: saved.id };
    }
  },
  {
    id: "cancel-anywhere",
    from: "*",
    event: "terminateJourney"
  }
];
```

## Option B: `tx` Helpers

Use `tx` helpers when transitions get larger and you want more fluent branching syntax.

```ts
const transitions = createTransitions(
  tx.from("start").on("goToNextStep").to("details", { id: "start-next" }),
  tx
    .from("details")
    .on("goToNextStep")
    .choose(
      tx.when(({ context }) => context.canContinue).to("review", { id: "details-next-guarded" }),
      tx.otherwise().to("review", {
        id: "details-save",
        effect: async ({ context }) => {
          const saved = await saveDraft(context);
          return { ...context, draftId: saved.id };
        }
      })
    ),
  tx.any().toTerminate({ id: "cancel-anywhere" })
);
```

## Which Style Should You Use?

- Choose plain objects if your team prefers direct JSON-like definitions.
- Choose `tx` helpers if your team prefers fluent composition and readable branching.
- Mix both when useful; `createTransitions(...)` accepts both built transitions and arrays.

## Transition Fields (Both Styles)

Core fields you can use regardless of syntax:

- `from`: source step id (or `"*"` wildcard)
- `event`: event type to match
- `to`: target step (for non-terminal transitions)
- `when`: optional guard (sync or async)
- `effect`: optional side effect/context updater (sync or async)
- `timeoutMs`: optional finite millisecond limit for async `when` and `effect`
- `id`: optional stable identifier for observability/debugging

For runtime semantics of guards/effects, see [Async Behavior](/docs/core/async).
