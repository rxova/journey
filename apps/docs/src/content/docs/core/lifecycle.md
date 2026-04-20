---
title: "Lifecycle"
---

Journey lifecycle is split into two things:

- machine status
- observation events

That split matters because status tells you what the machine is allowed to do, while events tell you what just
happened.

## Machine Status

A machine is always in one of four states:

- `idled`: created, hydrated, or reset, but not started yet
- `running`: normal operation
- `completed`: finished flow
- `terminated`: intentionally closed early

When status is `idled`, transitions and pointer navigation are blocked until `startJourney()`.
When status is terminal (`completed` or `terminated`), transitions and pointer navigation are blocked until `resetJourney()` and a later `startJourney()`.

```text
idled
  └─ startJourney() -> running

running
  ├─ completeJourney / COMPLETE target -> completed
  ├─ terminateJourney / TERMINATED target -> terminated
  └─ resetJourney() -> idled

completed or terminated
  └─ resetJourney() -> idled
```

## Startup State

A new machine starts from a known snapshot:

- `history.timeline = [initial]`
- `history.index = 0`
- `currentStepId = initial`
- `visited[initial] = true`
- `status = "idled"`

This consistent idle snapshot is why behavior is reproducible across environments.

Call `machine.startJourney()` to move the machine into `running`. That call emits `journey.start` with the current step and timestamp. Late subscribers do not receive a replayed startup event.
Calling `machine.resetJourney()` emits `journey.reset` after the idle snapshot is committed.

## Event Catalog

Use `subscribeEvent(...)` to observe lifecycle events.

| Event                    | When it appears                                      | Key payload                                           |
| ------------------------ | ---------------------------------------------------- | ----------------------------------------------------- |
| `journey.start`          | `machine.startJourney()` changes `idled -> running`  | `stepId`                                              |
| `journey.reset`          | `machine.resetJourney()` commits the idle snapshot   | `stepId`                                              |
| `transition.start`       | an event begins running through the send pipeline    | `from`, `event`                                       |
| `transition.success`     | a transition commits or fallback send succeeds       | `from`, `to`, `eventType`, `transitionId`, `label`    |
| `transition.error`       | selected guard or `updateContext` fails or times out | `from`, `eventType`, `transitionId`, `label`, `error` |
| `step.exit`              | machine leaves the current step                      | `stepId`                                              |
| `step.enter`             | machine enters a different step                      | `stepId`                                              |
| `journey.completed`      | machine reaches completed status                     | `stepId`                                              |
| `journey.terminated`     | machine reaches terminated status                    | `stepId`                                              |
| `navigation.previous`    | pointer moves backward                               | `from`, `to`, `requestedSteps`, `appliedSteps`        |
| `navigation.lastVisited` | pointer jumps back to the realized tail              | `from`, `to`                                          |

## Event Order

### Successful Step Change

For a normal step-to-step transition, the emitted order is:

1. `transition.start`
2. `step.exit` (if target differs)
3. `transition.success`
4. `step.enter` (if target differs)

```text
send(goToNextStep)
  -> transition.start
  -> step.exit
  -> transition.success
  -> step.enter
```

Same-step transitions do not re-enter. If a transition resolves from `a` to `a`, Journey still emits `transition.start` and `transition.success`, but it intentionally skips `step.exit` and `step.enter`.

### Failed Guard Or Context Update

If a selected guard throws, rejects, times out, or the selected `updateContext` throws, Journey emits `transition.error`, does not commit
navigation, and resolves the `send(...)` result with `error`.

```text
send(event)
  -> transition.start
  -> async guard work / sync context update
  -> transition.error
  -> no step commit
```

### Terminal Transition

When a terminal transition occurs, the order is:

1. `transition.start`
2. `transition.success` with `to: "COMPLETE"` or `to: "TERMINATED"`
3. `journey.completed` or `journey.terminated`

```text
send(completeJourney)
  -> transition.start
  -> transition.success (to COMPLETE)
  -> journey.completed
```

### Reset

Reset commits the fresh idle snapshot and then emits the reset event:

```text
resetJourney()
  -> journey.reset
```

### Pointer Navigation Helpers

Direct pointer helpers do not go through transition matching, so their event stream is navigation-focused:

```text
goToPreviousStep(2)
  -> step.exit
  -> navigation.previous
  -> step.enter
```

If previous-step navigation happens as a fallback from `send({ type: "goToPreviousStep" })`, that send still emits
`transition.start` before the navigation sequence and `transition.success` after it succeeds.

## Step Lifecycle Callbacks

For simple enter/leave side effects, attach `onEnter` and `onLeave` directly to a step definition instead of subscribing to events manually. Both callbacks receive `{ context }` at the moment the step is entered or left.

```ts
const machine = createJourneyMachine({
  context: { username: "" },
  steps: {
    login: {
      onLeave: ({ context }) => analytics.track("login_left", { user: context.username })
    },
    dashboard: {
      onEnter: ({ context }) => analytics.track("dashboard_entered"),
      onLeave: ({ context }) => console.log("leaving dashboard")
    }
  },
  transitions: ["login", "dashboard"]
});
```

With the graph builder, callbacks sit alongside transitions on the step:

```ts
const dashboardStep = createStep("dashboard", {
  onEnter: ({ context }) => analytics.track("dashboard_entered"),
  onLeave: ({ context }) => console.log("leaving dashboard"),
  on: { submit: [to("review")] }
});
```

Callbacks are **observational** — they run after the transition commit and cannot block or roll back it. Use transition `updateContext` when the transition itself must derive new context.

Terminal transitions follow the same lifecycle path as step-to-step transitions. If `completeJourney` or `terminateJourney` is backed by a declared transition with `onLeave` / `onEnter`, those callbacks run before the machine settles in `completed` or `terminated`.

If `onEnter` or `onLeave` throws or rejects, Journey logs a development diagnostic and leaves the committed transition result unchanged. Lifecycle callback failures do not emit `transition.error`.

React-specific step lifecycle hooks belong to `@rxova/journey-react`, not `@rxova/journey-core`. This page only documents the core runtime lifecycle contract.

## How To Think About It

- Use snapshot subscriptions when you care about current truth.
- Use lifecycle subscriptions when you care about causality and ordering.
- Use machine status when you need a coarse control gate.
- Use event types and payloads when you need analytics, logs, or debugging detail.

## Example: Observe Lifecycle

```ts
const unsubscribe = machine.subscribeEvent((event) => {
  if (event.type === "journey.start") {
    console.log("journey started at", event.stepId);
  }

  if (event.type === "transition.success") {
    console.log("transition", event.from, "->", event.to, event.eventType);
  }

  if (event.type === "journey.completed") {
    console.log("journey completed at", event.stepId);
  }
});
```

## Recommended Reading

- Read [Snapshot](./snapshot.md) for the state object these events explain.
- Read [Async Behavior](./async.md) for failure and timeout semantics.
- Read [Timeline Navigation](./history.md) for `navigation.previous` and `navigation.lastVisited`.
- Read [Runtime Queue](./architecture/runtime.md), [Send Pipeline](./architecture/send.md), and
  [Navigation Commits](./architecture/navigation.md) if you want the implementation side.
