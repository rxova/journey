---
title: "Handlers"
---

Graph guards and event work can call injected handlers without closing over application services.
This keeps graph definitions reusable and makes guard decisions straightforward to test.

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

Handlers reach the places where a definition decides something:

- graph `when` guards — including the candidates of a work send, whose guards also receive the
  run `result`;
- event work — the `run` and `commit` of a
  [transactional send](./usage/graph#transactional-sends-event-work).

Step hooks (`onEnter`, `onLeave`) and `onTransition` deliberately receive **no** handlers. This is a
design decision, not an omission. Hooks react to a move that has already committed: they get the
snapshot plus `updateContext`/`raise`, and nothing they do can influence routing or be rolled back.
Async that needs an injected client belongs in event work, where the transaction stages its outcome
before the guards route on it. A hook that must call a service can close over it at module scope —
and that closure is usually a hint the call wants to move into work.

Guards must stay synchronous because they are used to derive available transitions. Caller-driven
next/previous operations can attach asynchronous navigation work.

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
