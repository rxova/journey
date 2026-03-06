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

## ID-Based Navigation (Not Index-Based)

A key architecture decision is that Journey models movement by step id, not by array index.

Index-based steppers (`goToStepByIndex(2)`) are easy to break when steps are inserted, reordered, hidden behind conditions, or split into branches.

Journey transitions point to ids (`to: "review"`), and direct jumps are id-based (`send({ type: "goToStepById", stepId: "review" })`).

This keeps navigation stable even as flows evolve.

## Snapshot-First Runtime

The snapshot is the source of truth for what is happening right now.

It includes the current step, context, history, status, and async state. Instead of each component guessing, everyone reads the same state.

That shared truth is what makes rendering, debugging, and testing consistent.

The key shape is:

- `currentStepId`
- `history.timeline` and `history.index`
- `context`
- `visited`
- `stepMeta`
- `status`
- `async`

Canonical reference for full shape, field meaning, and examples: [Core Snapshot](/docs/core/snapshot).

## Why Timeline + Pointer

Journey history uses a timeline plus a pointer:

- `history.timeline` stores the realized path.
- `history.index` points to the current position.
- `currentStepId` always matches `history.timeline[history.index]`.

For deeper pointer and snapshot invariants, see [Core Snapshot](/docs/core/snapshot) and [Core Timeline Navigation](/docs/core/history).

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
Use `subscribeSelector` when you care about one selected slice of state.
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

### `subscribeSelector`: focused snapshot reactivity

`subscribeSelector` derives a selected value from snapshot and notifies only when that selected value changes.

```ts
const unsubscribe = machine.subscribeSelector(
  (snapshot) => snapshot.currentStepId,
  (next, previous) => {
    console.log("step changed:", previous, "->", next);
  }
);
```

Best for minimizing updates when only part of snapshot matters.

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
- `subscribeSelector` to react to specific state slices.
- `subscribeEvent` to understand how it changed.

## Why This Architecture Works

It is small enough to learn quickly, strict enough to stay predictable, and flexible enough for non-linear product flows.

That combination is why teams can move faster with fewer flow regressions.
