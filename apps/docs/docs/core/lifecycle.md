---
id: lifecycle
title: Lifecycle & events
---

# Lifecycle & events

## Controls

Lifecycle methods are synchronous and return `true` only when the requested state change applies.

| Method                         | Accepted transition                             |
| ------------------------------ | ----------------------------------------------- | ---------------------- |
| `controls.start()`             | `idle -> running`                               |
| `controls.pause()`             | `running -> paused`, when no hook is pending    |
| `controls.resume()`            | `paused -> running`                             |
| `controls.complete(payload?)`  | `running -> completed`, when no hook is pending |
| `controls.terminate(payload?)` | Any non-terminated status -> `terminated`       |
| `controls.restart()`           | `completed                                      | terminated -> running` |

`terminate()` invalidates pending hook continuations. `restart()` also resets context, history,
visits, and outcome before entering the initial step.

## Named subscription events

```ts
const stop = machine.subscriptions.subscribeEvent("stepEnter", ({ from, to, snapshot }) => {
  console.log(from, to, snapshot.status);
});
```

| Event               | Emitted when                                                                        |
| ------------------- | ----------------------------------------------------------------------------------- |
| `stepEnter`         | A destination commits, including initial entry.                                     |
| `stepLeave`         | A non-initial destination commits.                                                  |
| `statusChange`      | A lifecycle status changes.                                                         |
| `contextChange`     | `context.update` or a hook updater replaces context.                                |
| `navigationBlocked` | Navigation is rejected for any reason except `disposed`.                            |
| `error`             | Post-commit entry/transition work fails, or a raised-event cascade exceeds its cap. |

Listener exceptions are isolated and do not stop other listeners or alter runtime state.

## Navigation event order

For a successful non-initial move:

1. Publish `transition.phase: "leaving"`.
2. Await source `onLeave`.
3. Commit timeline and destination with phase `"entering"`.
4. Emit `stepLeave`, then `stepEnter`.
5. Await graph `onTransition`, then destination `onEnter`.
6. Publish the settled snapshot.
7. Notify plugin transition observers.
8. Process raised graph events FIFO.

Selector subscribers may run at each published snapshot boundary. Named events are the better fit
when event identity or ordering matters.

## Initial entry

`controls.start()` first changes status to `running`, then begins initial entry. Initial entry emits
`stepEnter` with `from: null`; it does not emit `stepLeave`. The method returns before asynchronous
entry work settles, so consumers should observe `snapshot.transition.pending` before navigating.

## Where to next

- [Step behavior](./usage/step-behavior)
- [Async behavior](./async)
- [Writing a plugin](./plugins/authoring)
