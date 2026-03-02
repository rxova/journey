---
id: lifecycle
title: Lifecycle
sidebar_label: Lifecycle
---

Journey lifecycle is designed to be explicit and predictable.

When teams can clearly see how a transition starts, succeeds, fails, or terminates, flow bugs become easier to diagnose.

## Machine Status

A machine is always in one of three states:

- `running`: normal operation.
- `complete`: finished flow.
- `terminated`: intentionally closed early.

When status is terminal (`complete` or `terminated`), transitions and pointer navigation are blocked until `resetMachine()`.

## Startup State

A new machine starts from a known snapshot:

- `history.timeline = [initial]`
- `history.index = 0`
- `currentStepId = initial`
- `visited[initial] = true`
- `status = "running"`

This consistent start is why behavior is reproducible across environments.

## Transition Event Lifecycle

Use `subscribeEvent` to observe lifecycle events:

- `transition.start`
- `transition.success`
- `transition.error`
- `step.exit`
- `step.enter`
- `journey.complete`
- `journey.close`
- `navigation.previous`
- `navigation.lastVisited`
- `metadata.updated`

## Event Order (Successful Step Change)

For a normal step-to-step transition, emitted order is:

1. `transition.start`
2. `step.exit` (if target differs)
3. `transition.success`
4. `step.enter` (if target differs)

If a transition defines `effect`, it runs after `transition.start` and before commit events.

If an effect throws/rejects, Journey emits `transition.error` and does not commit navigation.

## Terminal Events

When a terminal transition occurs:

- Journey emits `transition.success` with terminal target.
- Then emits either `journey.complete` or `journey.close`.

This makes completion and termination easy to observe separately in analytics and logs.

## Example: Observe Lifecycle

```ts
const unsubscribe = machine.subscribeEvent((event) => {
  if (event.type === "transition.success") {
    console.log("transition", event.from, "->", event.to, event.eventType);
  }

  if (event.type === "journey.complete") {
    console.log("journey completed at", event.stepId);
  }
});
```
