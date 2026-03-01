---
id: architecture
title: Architecture
sidebar_label: Architecture
---

Journey architecture is built around one goal: make complex product flows easy to reason about.

If your flow has branching, async checks, retries, and recovery paths, the architecture should help your team stay calm and confident, not fight hidden state.

## The Core Idea

Journey models a flow as three simple parts:

- `steps`: where a user can be.
- `transitions`: how a user can move.
- `snapshot`: the current truth of the runtime.

This keeps the definition small, but still powerful enough for real-world journeys.

## Snapshot-First Runtime

The snapshot is the source of truth for what is happening right now.

It includes the current step, context, history, status, and async state. Instead of each component guessing, everyone reads the same state.

That shared truth is what makes rendering, debugging, and testing consistent.

### What the snapshot looks like

```ts
const snapshot = machine.getSnapshot();

// Example shape
const exampleSnapshot = {
  currentStepId: "payment",
  history: {
    timeline: ["start", "details", "payment"],
    index: 2
  },
  context: {
    isVip: false
  },
  visited: {
    start: true,
    details: true,
    payment: true,
    review: false
  },
  stepMeta: {
    start: {},
    details: {},
    payment: {},
    review: {}
  },
  status: "running",
  async: {
    isLoading: false,
    byStep: {
      start: { phase: "idle", eventType: null, transitionId: null, error: null },
      details: { phase: "idle", eventType: null, transitionId: null, error: null },
      payment: { phase: "idle", eventType: null, transitionId: null, error: null },
      review: { phase: "idle", eventType: null, transitionId: null, error: null }
    }
  }
};
```

What each part means:

- `currentStepId`: where the user is now.
- `history.timeline`: the path the user actually took.
- `history.index`: where we are in that path.
- `context`: shared data for decisions.
- `visited`: which steps have been seen.
- `stepMeta`: per-step runtime metadata.
- `status`: journey lifecycle (`running`, `complete`, `terminated`).
- `async`: loading/error phase per step.

Invariant: `currentStepId` always equals `history.timeline[history.index]`.

## Why Timeline + Pointer

Journey history uses a timeline plus a pointer:

- `history.timeline` stores the realized path.
- `history.index` points to the current position.
- `currentStepId` always matches `history.timeline[history.index]`.

This model gives predictable navigation. Going back is a pointer move, not a destructive rewrite. Moving forward after going back can safely replace the old future path.

## Deterministic Transitions

Transitions are checked in order, and the first valid match wins.

That sounds simple, but it matters a lot: deterministic behavior is easier to test, easier to explain in code review, and safer to refactor.

## Back Behavior That Feels Natural

`back` is an event. Journey handles it in two steps:

1. It tries explicit matching `back` transitions.
2. If none match, it falls back to `goToPreviousStep(1)`.

You get control when you need it, and useful default behavior when you do not.

## Separation of Concerns

Journey is split into clear packages:

`@rxova/journey-core` is the runtime model and behavior engine.

`@rxova/journey-react` is typed React bindings (Provider, hooks, renderer) on top of that core.

`@rxova/journey-devtools-bridge` connects runtime behavior to devtools protocols.

This separation lets teams evolve UI ergonomics without rewriting flow semantics.

## Observability by Design

Journey is built to be observable from day one.

Use `subscribe` when you care about current state.
Use `subscribeEvent` when you care about what just happened.

### `subscribe`: snapshot change reactivity

`subscribe` gives a simple signal that state changed. It does not pass an event payload.

```ts
const unsubscribe = machine.subscribe(() => {
  const snapshot = machine.getSnapshot();
  console.log("render step:", snapshot.currentStepId);
  console.log("status:", snapshot.status);
});
```

Best for UI rendering and reactive state updates.

### `subscribeEvent`: typed lifecycle telemetry

`subscribeEvent` gives detailed event objects such as transition start/success/error, step enter/exit, and navigation events.

```ts
const unsubscribe = machine.subscribeEvent((event) => {
  if (event.type === "transition.success") {
    console.log("moved", event.from, "->", event.to, "via", event.eventType);
  }

  if (event.type === "transition.error") {
    console.error("transition failed:", event.error);
  }
});
```

Best for analytics, logging, debugging, and audit trails.

In practice, teams usually use both:

- `subscribe` to render what is true now.
- `subscribeEvent` to understand how it changed.

## Why This Architecture Works

It is small enough to learn quickly, strict enough to stay predictable, and flexible enough for non-linear product flows.

That combination is why teams can move faster with fewer flow regressions.
