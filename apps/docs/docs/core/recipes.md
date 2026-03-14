---
id: recipes
title: Recipes
sidebar_label: Recipes
---

## Default Back Behavior (No Transition Needed)

```ts
await machine.send({ type: "back" });
```

If no explicit back transition matches, core moves to previous timeline position.

## Explicit Back Override

```ts
transitions: [{ from: "review", event: "back", to: "confirmExit" }];
```

Explicit transition wins over default fallback.

## Jump Back Multiple Steps

```ts
await machine.goToPreviousStep(3);
```

## Jump to Tail After Inspecting Past

```ts
await machine.goToLastVisitedStep();
```

## Update Context

```ts
machine.updateContext((context) => ({
  ...context,
  dirty: true
}));
```

## Update Step Metadata

```ts
machine.updateStepMetadata("details", (meta) => ({
  ...meta,
  title: "Details (updated)"
}));
```

## Observe Lifecycle Events

```ts
const unsubscribe = machine.subscribeEvent((event) => {
  if (event.type === "transition.error") {
    console.error(event.error);
  }
});
```

## Builder Ergonomics

```ts
const journey = {
  transitions: ({ tx, createTransitions }) =>
    createTransitions(
      tx
        .from("details")
        .on("goToNextStep")
        .choose(({ when, otherwise }) => [
          when(({ context }) => context.includeExtra).to("extra"),
          otherwise().to("review")
        ])
    )
};
```
