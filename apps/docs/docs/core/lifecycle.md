---
id: lifecycle
title: Lifecycle
sidebar_label: Lifecycle
---

## Machine Status

- `running`
- `complete`
- `terminated`

Pointer navigation and event transitions are blocked when status is terminal (`complete`/`terminated`) until `resetMachine()`.

## Startup

Initial snapshot:

- `timeline = [initial]`
- `index = 0`
- `currentStepId = initial`
- `visited = { [initial]: true }`
- `status = "running"`

## Transition Lifecycle Events

Use `subscribeEvent` to observe runtime lifecycle:

- `transition.start`
- `transition.success`
- `transition.error`
- `step.exit`
- `step.enter`
- `journey.complete`
- `journey.close`

## Event Order And Effects

Successful step-to-step transitions emit in this order:

1. `transition.start`
2. `step.exit` (only if target step differs)
3. `transition.success`
4. `step.enter` (only if target step differs)

When a transition has `effect`, it runs after `transition.start` and before `step.exit`/`transition.success`.

If `effect` throws/rejects, runtime emits `transition.error` and does not commit step navigation.

Navigation APIs emit:

- `navigation.previous`
- `navigation.lastVisited`

Metadata updates emit:

- `metadata.updated`
