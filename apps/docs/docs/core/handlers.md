---
id: handlers
title: Handlers
---

# Handlers

Graph guards can call injected handlers without closing over application services. This keeps graph
definitions reusable and makes guard decisions straightforward to test.

## Declare handlers

```ts
type Handlers = {
  canApprove(role: string): boolean;
};

const definition = {
  initial: "review" as const,
  context: { role: "member" },
  handlers: {
    canApprove: (role: string) => role === "admin"
  } satisfies Handlers,
  steps: {
    review: {},
    approved: {}
  },
  transitions: {
    APPROVE: {
      from: "review" as const,
      to: "approved" as const,
      when: ({ context, handlers }: { context: { role: string }; handlers: Handlers }) =>
        handlers.canApprove(context.role)
    }
  }
};
```

## Override at creation

Creation options take precedence over handlers stored in the definition:

```ts
const production = createGraphJourney(definition);

const test = createGraphJourney(definition, {
  handlers: { canApprove: () => true }
});
```

## Scope

Handlers are passed only to graph `when` guards. Step hooks and `onTransition` receive the current
snapshot instead. Guards must stay synchronous because they are used to derive available
transitions. Caller-driven next/previous operations can attach asynchronous navigation work.

The graph builder's type bag can declare handler types:

```ts
const { createStep, to, build } = createGraphJourneyBuilder<{
  context: Context;
  stepId: StepId;
  events: Event;
  handlers: Handlers;
}>();
```

## Where to next

- [Graph](./usage/graph)
- [Graph builder](./api/graph-builder)
- [Transitions syntax](./api/transitions-syntax)
