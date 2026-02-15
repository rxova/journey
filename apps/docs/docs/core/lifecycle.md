---
title: Lifecycle and Transitions
sidebar_position: 5
---

This page describes the transition pipeline from event dispatch to settled state.

## Event Pipeline

For each `send(event)` call:

1. Event is queued (serialized execution).
2. Candidate transitions are scanned in array order.
3. First transition whose `from` + `event` match is selected.
4. `when` executes (if present).
5. `effect` executes (if present).
6. Snapshot is committed and subscribers are notified.

## Selection Rules

- First match wins.
- Guards (`when`) can reject movement (`false`).
- No match returns `{ transitioned: false }`.

## Terminal Lifecycle

When target is terminal:

- `JOURNEY_TERMINAL.COMPLETE` => `status = "complete"`
- `JOURNEY_TERMINAL.CLOSE` => `status = "closed"`

After terminal status, `send(...)` does not transition until `reset()`.

## Reset Lifecycle

`reset()` restores:

- `current = initial`
- `context = initial context`
- `history = []`
- `visited = [initial]`
- all async phases to `idle`

## Error Lifecycle

If `when`/`effect` throws:

- `send(...)` rejects
- current step async phase becomes `error`
- captured error is exposed at `snapshot.async.byStep[current].error`

Recovery:

```ts
machine.clearStepError();
```

## Queue Resilience

A failed event does not poison the queue; future sends continue processing.

This is critical for UX flows with intermittent network/validation failures.
