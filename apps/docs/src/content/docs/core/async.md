---
title: "Async Behavior"
---

Journey treats async work as a first-class part of transition selection, but state writes stay synchronous and queued.

## Mental Model

```text
transition.start
  -> when?         -> evaluating-when
  -> updateContext -> snapshot commit -> idle
  -> failure       -> transition.error -> error
```

The active step keeps async state in `snapshot.async.byStep[stepId]`, while `snapshot.async.isLoading`
answers the machine-wide question "is any async transition work currently in flight?".

## Guard vs Update

| Part            | Purpose                                | Runs when                        | Can change context? |
| --------------- | -------------------------------------- | -------------------------------- | ------------------- |
| `when`          | decide whether a transition is allowed | before commit                    | no                  |
| `updateContext` | derive the next context                | only for the selected transition | yes, synchronously  |

`when` may be sync or async. `updateContext` is sync only.

## Async Guards (`when`)

Use `when` to decide whether a transition is allowed right now.

```ts
{
  from: "payment",
  event: "goToNextStep",
  to: "review",
  when: async ({ context, handlers, signal }) => {
    return await handlers.validateCard(context.cardToken, { signal });
  }
}
```

Think of guards as permission checks.

## Sync Transition Updates (`updateContext`)

Use transition `updateContext` to derive the next context from the current `context` and triggering `event`.

```ts
{
  from: "details",
  event: "draftSaved",
  to: "review",
  updateContext: ({ context, event }) => ({
    ...context,
    draftId: event.payload?.draftId ?? null
  })
}
```

If you need async work to produce data for the next state, do it before `send(...)` and put the resolved data in the event payload.

## Lifecycle Callbacks

Definition-level `handlers`, `onEnter`, and `onLeave` may still perform async work, but they are observational helpers around the transition pipeline. They do not define a separate transition phase in `snapshot.async`, and failures there are treated as lifecycle diagnostics rather than `transition.error`.

## Observable Async Phases

Per-step async phases are:

- `idle`
- `evaluating-when`
- `error`

Typical UI mappings:

- `phase === "evaluating-when"`: disable controls or show validation state
- `phase === "error"`: show recoverable error UI
- `phase === "idle"`: render normal interactive state

## Transition Arguments

Every `when` receives a single args object:

```ts
when: async ({ snapshot, context, from, timeline, index, event, signal, handlers }) => {
  return true;
};
```

Transition `updateContext` receives the same transition state without `signal` or `handlers` because it must stay synchronous:

```ts
updateContext: ({ snapshot, context, from, timeline, index, event }) => {
  return context;
};
```

## Timeouts

Add `timeoutMs` to a transition to cap async `when` work.

```ts
{
  id: "payment-review",
  from: "payment",
  event: "goToNextStep",
  to: "review",
  timeoutMs: 5_000,
  when: async ({ context, handlers, signal }) => {
    return await handlers.validateCard(context.cardToken, { signal });
  }
}
```

If async work does not settle before the timeout, Journey resolves the send result with `transitioned: false`, emits `transition.error`, and moves the source step into async `error`.

## `updateContext()` During In-Flight Async Work

All writes share one queue.

- A running async `when` keeps the args it started with.
- An external `updateContext()` call waits in the same queue instead of racing a second write lane.
- If a context change must affect the current transition decision, apply it before `send(...)` or include it in the event payload.

Practical rule:

- async work decides
- events carry resolved data
- transition `updateContext` commits the next context synchronously
