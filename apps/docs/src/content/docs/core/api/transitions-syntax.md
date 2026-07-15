---
id: transitions-syntax
title: Transitions syntax
---

# Transitions syntax

Linear order and graph events are separate definition forms in V1.

## Linear steps

```ts
const definition = {
  context: { valid: false },
  steps: [
    "intro",
    {
      id: "form",
      metadata: { title: "Form" },
      onLeave: ({ snapshot }) => analytics.track("form_left", snapshot.context)
    },
    {
      id: "done",
      onEnter: ({ snapshot }) => report(snapshot.context)
    }
  ] as const
};
```

The array order controls initial selection, next-step fallback, and linear snapshot indices. A bare
string is shorthand for `{ id, metadata: {} }`.

## Graph transitions map

Graph transitions are keyed by event type:

```ts
const definition = {
  initial: "form" as const,
  context: { valid: false },
  steps: {
    form: {},
    review: {},
    done: {}
  },
  transitions: {
    SUBMIT: [
      { from: "form", to: "review", when: ({ context }) => context.valid },
      { from: "form", to: "form" }
    ],
    APPROVE: {
      from: "review",
      to: "done",
      onTransition: ({ raise }) => raise({ type: "AUDIT" })
    }
  }
};
```

| Field          | Purpose                                                       |
| -------------- | ------------------------------------------------------------- |
| `from`         | Required source step.                                         |
| `to`           | Required destination step. Self-transitions are allowed.      |
| `when`         | Optional synchronous guard receiving `{ context, handlers }`. |
| `onTransition` | Optional post-commit effect receiving hook arguments.         |

For an array, declaration order is priority order. The first candidate matching the current source
and passing its guard is selected.

## Graph builder

The builder colocates outgoing transitions with their source step and compiles them to the same
central transitions map:

```ts
const form = createStep("form", {
  on: {
    SUBMIT: ({ to }) => [to("review").when(({ context }) => context.valid)]
  }
});
```

Use the callback form when `onTransition` needs the event payload narrowed to one event member.

## Validation

Factories reject empty definitions, duplicate linear ids, unknown graph initial steps, and graph
transitions that reference undeclared steps. Graph guards that throw are treated as disabled.

## Where to next

- [Linear](../usage/linear)
- [Graph](../usage/graph)
- [Graph builder](./graph-builder)
