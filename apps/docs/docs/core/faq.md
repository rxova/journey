---
title: FAQ
sidebar_position: 4
---

## Is this a router?

No. `@rxova/journey-core` is an in-memory state machine for step flows.

It does not manage browser URLs, route matching, or page lifecycle.

## Is this tied to React?

No. Core is headless and has no UI dependency.

Use it from any environment (Node, tests, CLI tools, custom renderers, or any frontend framework).

## How does this differ from a simple step index (`currentStep++`)?

A single index breaks down for real flows with branching, conditional skips, confirmation loops, and global actions.

Journey uses explicit transitions and history so those cases stay predictable.

## What happens if multiple transitions match?

The first matching transition in `transitions` array order is used.

If ordering matters, put highest-priority transitions first.

## What is the exact difference between `when` and `effect`?

- `when` answers: "is this transition allowed?"
- `effect` answers: "what work should run while transitioning?"

Use `when` for gating and `effect` for side effects/context updates.

## Can `when` and `effect` be async?

Yes.

- `when` can return `Promise<boolean>`.
- `effect` can return `Promise<context | void>`.

## What if `when` or `effect` throws?

- `send(...)` rejects.
- Current step async phase becomes `error`.
- Error is stored at `snapshot.async.byStep[current].error`.
- Call `clearStepError(stepId?)` to clear it.

## Do rapid clicks or concurrent sends cause race conditions?

No. `send(...)` is internally queued and processed in order.

If one send fails, later sends still process.

## How does `back` work?

Core does not hardcode "back".

You typically model back with:

```ts
{ from: "*", event: "back", to: HISTORY_TARGET }
```

`HISTORY_TARGET` resolves to the most recent valid step from `history`.

## What is `visited`, and how is it different from `history`?

- `history`: stack of previous steps (used for back behavior).
- `visited`: unique ordered list of all reached steps.

History may be trimmed; `visited` remains a full visit trail for the machine lifetime (until reset/hydrate).

## Why did my history get shorter automatically?

Because of `maxHistory`.

- Default is `50`.
- Set `maxHistory: null` to disable trimming.
- Subscribe to `history.onOverflow` to observe trimming.

## What does persistence store?

Persistence stores:

- `current`
- `context`
- `history`
- `visited`
- `status`
- wrapper `version`

It does not store runtime async state (`snapshot.async`).

## What happens if persisted data is invalid or stale?

Core safely falls back to initial snapshot when necessary.

If versions differ and you provide `migrate`, your migration result is validated/coerced before hydration.

## Do I need to pass custom storage?

Only if you do not want default `localStorage`.

If no valid storage is available, persistence is silently disabled and machine still runs.

## Why does `send()` return a Promise even for sync transitions?

Because guard/effect can be async, and sends are always queued for deterministic ordering.

A single async API avoids split behavior.

## What does `transitioned: false` mean?

It means no state transition happened.

Common reasons:

- no transition matched event
- all matching guards returned `false`
- machine already terminal (`complete`/`closed`)

## Can I jump to a specific step directly?

Yes, with built-in `goTo` event:

```ts
await machine.send({ type: "goTo", to: "review" });
```

Invalid targets throw.

## Can terminal states still update context?

The transition that enters terminal can apply effect/context updates first.

After terminal status is reached, future sends do not transition until `reset()`.

## Does reset clear persisted state?

By default, yes (`clearOnReset: true`).

Set `clearOnReset: false` if you want reset snapshot persisted instead.

## How do I observe machine changes?

Use `subscribe(listener)` and call `getSnapshot()` inside the listener.

Subscribers are notified for transition changes and async phase updates.

## Should transitions be treated as business rules?

Yes.

Keep navigation rules in transitions and keep UI components thin. This makes flows easier to test and reuse.
