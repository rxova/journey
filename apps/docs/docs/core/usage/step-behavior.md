---
id: step-behavior
title: Step behavior
sidebar_label: Step behavior
---

# Step behavior

Beyond moving between steps, a flow needs to _react_ to them — guard a move, run work on arrival,
fire telemetry on exit, expire an idle screen. Journey exposes five hooks for that: **`when`**,
**`after`**, **`effect`**, **`onEnter`**, and **`onLeave`**. They're small and composable, but each
belongs in a specific place and not every one is available in every mode.

This page is the map: what each hook is for, where it's declared, and which of the three modes
honors it. The deep dives live elsewhere — [Effects](/docs/core/effects) for `effect`/`after`,
[Lifecycle & events](/docs/core/lifecycle) for `onEnter`/`onLeave`, and [Graph](/docs/core/usage/graph)
for `when`. Here we focus on _which to reach for, and when_.

## The hooks at a glance

| Hook           | Declared on                | Runs…                                | Can be async?          | What it's for                               |
| -------------- | -------------------------- | ------------------------------------ | ---------------------- | ------------------------------------------- |
| `when` (guard) | a transition candidate     | before a transition commits          | ✅ yes                 | Decide whether a move is _allowed_          |
| `effect`       | a step                     | on entry, async work in flight       | ✅ (it _is_ the async) | Do work on arrival and branch on the result |
| `after`        | a step                     | once the step has been active `N` ms | ⏱ timer-driven         | Auto-advance, idle timeouts, cooldowns      |
| `onEnter`      | a step **or** a transition | after a step is entered              | ✅ awaited             | Observational side effects on arrival       |
| `onLeave`      | a step **or** a transition | after a step is left                 | ✅ awaited             | Observational side effects on exit          |

:::warning The dividing line
`when`, `effect`, and `after` **influence the flow** — a guard blocks a move, an effect routes to a
branch, a timer fires a transition. `onEnter`/`onLeave` are **observational**: they run _after_ the
move commits and can't block or redirect it. If a hook needs to derive state as part of the move,
that's [`updateContext`](#updatecontext-every-place-it-lives), not a callback.
:::

## Availability per mode

The three modes constrain the machine differently, so they expose different hooks. The rule of thumb:
**guards need transitions, effects/timers need a transition graph to route through, lifecycle
callbacks work everywhere.**

| Hook      | Linear        | Graph | Headless          |
| --------- | ------------- | ----- | ----------------- |
| `when`    | ⛔ no guards¹ | ✅    | ⛔ no transitions |
| `effect`  | ✅            | ✅    | ⛔ ignored²       |
| `after`   | ✅            | ✅    | ⛔ ignored²       |
| `onEnter` | ✅            | ✅    | ✅                |
| `onLeave` | ✅            | ✅    | ✅                |

> ¹ Linear derives its transitions from step order and intentionally has no guards — the path is the
> ordered list. When a step needs to branch on a condition, that's the signal to graduate to
> [graph mode](/docs/core/usage/graph).
>
> ² Headless declares no transition graph, so there's nowhere for an `effect`'s result or an
> `after` timer to route to. The runtime logs a development warning and ignores them. `onEnter`/
> `onLeave` still fire, because they hang off `step.enter` / `step.exit`, which `goToStepById`
> produces in every mode.

### Where each one is declared

```ts
// when, onEnter, onLeave — on a transition (graph only)
to("review")
  .when(({ context }) => context.valid) // guard
  .updateContext(/* … */);

createStep("review", {
  onEnter: () => analytics.track("review_entered"), // step-level lifecycle
  onLeave: () => analytics.track("review_left"),
  effect: {
    /* async work on entry */
  },
  after: { 30_000: { to: "expired" } }, // delayed transition
  on: { approve: [to("approved")] }
});
```

```ts
// Linear — the same step-level hooks live on the step object
createLinearJourney({
  context: { seen: false },
  steps: [
    "intro",
    {
      id: "splash",
      onEnter: () => analytics.track("splash"),
      after: { 2_000: { to: "home" } }
    },
    "home"
  ]
});
```

## updateContext: every place it lives

`updateContext` is how you write to context. It shows up in **five** places — and they split into two
families that behave differently. This catch you off guard once: the one named after a method is
**async**, the ones declared on transitions/effects/timers are **synchronous**.

### Declarative `updateContext` — synchronous, pure

Wherever `updateContext` is a _field_ on a transition, effect branch, or timer, it's a pure
synchronous function: it receives the move's inputs and **returns the next context**. It runs _inside_
the transition the runtime is already committing, so it can't be async — the new context has to be
ready the moment the move lands.

| Site                       | Declared on            | Modes         | Receives (besides `context`, `snapshot`, `from`) |
| -------------------------- | ---------------------- | ------------- | ------------------------------------------------ |
| Transition `updateContext` | a transition candidate | Graph         | `event`, `timeline`, `index`                     |
| Effect `onResolved`        | `effect.onResolved`    | Linear, Graph | `output` (the resolved value of `run`)           |
| Effect `onRejected`        | `effect.onRejected`    | Linear, Graph | `error` (the thrown value)                       |
| `after` transition         | `after[ms]`            | Linear, Graph | — (just the base args)                           |

```ts
// On a transition — derive from the event payload
to("review").updateContext(({ context, event }) => ({
  ...context,
  couponCode: event.payload?.code ?? null
}));

// On an effect's success branch — derive from the resolved output
effect: {
  run: ({ handlers }) => handlers.loadProfile(),
  onResolved: {
    to: "ready",
    updateContext: ({ context, output }) => ({ ...context, tier: output.tier })
  },
  onRejected: {
    to: "blocked",
    updateContext: ({ context, error }) => ({ ...context, reason: String(error) })
  }
}

// On a timer — derive on auto-advance
after: {
  2_000: { to: "home", updateContext: ({ context }) => ({ ...context, seen: true }) }
}
```

Each returns the whole next context — treat it immutably (`{ ...context, … }`), never mutate in
place. Because it's synchronous, it can't `await`; if you need async work to _produce_ the value,
that's an [`effect`](/docs/core/effects), whose resolved `output` then flows into `updateContext`.

### Imperative `machine.updateContext()` — asynchronous, queued

The method on the machine instance is the odd one out. It takes an updater and returns a
`Promise<JourneySnapshot>`, because it's **queued through the same serialized pipeline** as every
other event — it settles in order, after whatever is already in flight.

```ts
const snapshot = await machine.updateContext((context) => ({
  ...context,
  acceptedTerms: true
}));
```

Reach for it when context changes _outside_ a transition — a checkbox toggles, a field updates, a
server response arrives between steps. It's available in **all three modes** and is the primary way
headless flows mutate context, since they have no transitions to carry a declarative update.

:::tip Which one do I want?
If the change is **part of a move** — "when this transition fires, also set X" — put `updateContext`
on the transition/effect/timer (synchronous, atomic with the move). If the change is **on its own** —
a user edited a field, no navigation involved — call `machine.updateContext()` (asynchronous,
queued). Same name, deliberately: it's always "produce the next context immutably," only the trigger
and timing differ.
:::

## Where to next

- [Effects](/docs/core/effects) — `effect` and `after` in full, with cancellation and timeouts.
- [Lifecycle & events](/docs/core/lifecycle) — `onEnter`/`onLeave`, event order, and `dispatch`.
- [Graph](/docs/core/usage/graph) — `when` guards and transition-level `updateContext`.
- [Async behavior](/docs/core/async) — what happens when a guard or effect rejects or times out.
