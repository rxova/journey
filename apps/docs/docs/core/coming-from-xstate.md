---
id: coming-from-xstate
title: Coming from XState
---

# Coming from XState

Journey borrows familiar ideas such as context, events, guards, and entry/exit work, but it targets
step-based product flows rather than general statecharts.

## Concept map

| XState concept           | Journey V1                                                |
| ------------------------ | --------------------------------------------------------- |
| Machine states           | Journey steps                                             |
| Initial state            | Graph `initial`, or first linear step; `startAt` override |
| Context                  | Snapshot `context`                                        |
| Event union              | `{ type; payload? }` union sent as `send(type, payload?)` |
| Guard                    | Graph transition `when({ context, handlers })`            |
| Exit action              | Step `onLeave`                                            |
| Caller-driven async gate | Next/previous navigation `run`                            |
| Transition action        | Graph `onTransition`                                      |
| Entry action             | Step `onEnter`                                            |
| `assign`                 | `context.update` or hook `updateContext`                  |
| Actor snapshot           | `machine.getSnapshot()`                                   |
| Actor subscription       | Named events or selector subscriptions                    |
| Raised/internal event    | Hook `raise(event)`                                       |
| Final state              | Explicit `controls.complete(payload?)`                    |

## Different async model

Journey does not have actors or `invoke`. Put caller-driven asynchronous validation that must block
a next/previous move in navigation `run`, with synchronous context writes in `commit`. For an
event-driven graph process, model long-running work as a step: perform it in `onEnter`, then raise a
domain event that selects the success or failure destination.

```ts
const loading = createStep("loading", {
  onEnter: async ({ snapshot, updateContext, raise }) => {
    try {
      const user = await loadUser(snapshot.context.id);
      updateContext((context) => ({ ...context, user }));
      raise({ type: "LOADED" });
    } catch (error) {
      updateContext((context) => ({ ...context, error }));
      raise({ type: "FAILED" });
    }
  },
  on: {
    LOADED: [to("ready")],
    FAILED: [to("failed")]
  }
});
```

The current step remains `loading` while `onEnter` runs, and its async state is visible in the
snapshot. Raised events run after entry settles.

## What Journey adds for product flows

- A realized browser-like timeline with back/forward pointer semantics.
- Linear and event-driven definitions over the same runtime.
- Current-step metadata and first-visit state in the snapshot.
- Explicit completed/terminated outcomes.
- Small, separately imported observation plugins.

## What Journey intentionally leaves out

- hierarchical and parallel states;
- actor spawning and actor messaging;
- delayed-transition syntax;
- statechart history nodes;
- transition interception by plugins.

Choose Journey when the domain is a user journey with steps and a meaningful realized path. Choose a
general statechart when the missing semantics above are part of the actual model.

## Where to next

- [Effects](./effects)
- [Graph](./usage/graph)
- [Comparison](./comparison)
