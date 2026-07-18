---
id: lifecycle
title: Lifecycle & events
---

# Lifecycle & events

## Controls

Lifecycle methods are synchronous and return `true` only when the requested state change applies.

| Method                         | Accepted transition                                   |
| ------------------------------ | ----------------------------------------------------- |
| `controls.start()`             | `idle -> running`                                     |
| `controls.pause()`             | `running -> paused`, when no navigation is pending    |
| `controls.resume()`            | `paused -> running`                                   |
| `controls.complete(payload?)`  | `running -> completed`, when no navigation is pending |
| `controls.terminate(payload?)` | Any non-terminated status -> `terminated`             |
| `controls.restart()`           | Completed or terminated -> `running`                  |

`terminate()` invalidates pending hook continuations. `restart()` also resets context, history,
visits, and outcome before entering the initial step.

## Named subscription events

```ts
const stop = machine.subscriptions.subscribeEvent("stepEnter", ({ from, to, direction }) => {
  console.log(from, to, direction);
});
```

| Event               | Emitted when                                                          |
| ------------------- | --------------------------------------------------------------------- |
| `stepEnter`         | A destination commits, including initial entry.                       |
| `stepLeave`         | A non-initial destination commits.                                    |
| `statusChange`      | A lifecycle status changes.                                           |
| `contextChange`     | `context.update` or a hook updater replaces context.                  |
| `navigationBlocked` | Navigation is rejected for any reason except `disposed`.              |
| `error`             | Navigation work, a lifecycle effect, or a raised-event cascade fails. |

The `stepEnter` payload carries `direction: "forward" | "backward" | "jump"`
(`StepEnterDirection`), reported by intent rather than index math: only `goToNextStep` and
`goToPreviousStep` report `"forward"`/`"backward"`; the initial entry, `goToStepById`,
`goToStepByIndex`, `goToLastVisitedStep`, and graph `send` report `"jump"`.

Listener exceptions are isolated and do not stop other listeners or alter runtime state.

## Navigation event order

For a successful non-initial move:

1. If work was supplied, publish phase `"working"` and await `work.run`.
2. Run `work.commit` synchronously against staged context.
3. Atomically commit staged context, timeline, and destination.
4. Emit `contextChange` when needed, then `stepLeave` and `stepEnter`.
5. Await source `onLeave`, graph `onTransition`, and destination `onEnter` in that order.
6. Publish the settled snapshot and notify plugin transition observers.
7. Process raised graph events FIFO.

A `run` or `commit` failure stops before step 3. Lifecycle-effect failures are reported after the
move and never roll the committed destination back.

Selector subscribers may run at each published snapshot boundary. Named events are the better fit
when event identity or ordering matters.

## Initial entry

`controls.start()` first changes status to `running`, then begins initial entry. Initial entry emits
`stepEnter` with `from: null` and `direction: "jump"`; it does not emit `stepLeave`. The method
returns before asynchronous entry work settles, so consumers should observe
`snapshot.transition.pending` before navigating.

The `startAt` runtime option changes which step initial entry targets: the journey starts directly
at that step, earlier steps are neither entered nor visited, the timeline begins as `[startAt]`,
and `controls.restart()` returns to it. On graph journeys `startAt` overrides `initial`. An
unknown id throws at creation.

## Where to next

- [Step behavior](./usage/step-behavior)
- [Async behavior](./async)
- [Writing a plugin](./plugins/authoring)
