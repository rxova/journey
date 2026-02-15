---
title: API Reference
sidebar_position: 2
---

This page documents the full `@rxova/journey-core` runtime contract.

## Core Exports

### Functions

- `createJourneyMachine(journey, options?)`
- `createPersistenceController(...)` (advanced, usually internal)

### Constants

- `JOURNEY_EVENT.GO_TO` (`"goTo"`)
- `JOURNEY_WILDCARD` (`"*"`)
- `HISTORY_TARGET` (`"__HISTORY__"`)
- `JOURNEY_TERMINAL.COMPLETE` (`"COMPLETE"`)
- `JOURNEY_TERMINAL.CLOSE` (`"CLOSE"`)
- `JOURNEY_STATUS.RUNNING` (`"running"`)
- `JOURNEY_STATUS.COMPLETE` (`"complete"`)
- `JOURNEY_STATUS.CLOSED` (`"closed"`)
- `JOURNEY_ASYNC_PHASE.IDLE` (`"idle"`)
- `JOURNEY_ASYNC_PHASE.EVALUATING_WHEN` (`"evaluating-when"`)
- `JOURNEY_ASYNC_PHASE.RUNNING_EFFECT` (`"running-effect"`)
- `JOURNEY_ASYNC_PHASE.ERROR` (`"error"`)

## Journey Definition

```ts
type JourneyDefinition<TContext, TStepId extends string, TEventType extends string> = {
  initial: TStepId;
  context: TContext;
  steps: Record<TStepId, unknown>;
  transitions: readonly JourneyTransition<TContext, TStepId, TEventType>[];
};
```

Rules validated at machine creation:

- `steps` must be an object.
- `transitions` must be an array.
- `initial` must exist in `steps`.
- Every transition `from` must be a known step or `"*"`.
- Every transition `to` must be a known step, `HISTORY_TARGET`, or a terminal constant.

## Transition Model

```ts
type JourneyTransition<TContext, TStepId extends string, TEventType extends string> = {
  id?: string;
  from: TStepId | "*";
  event: TEventType | "goTo";
  to: TStepId | "__HISTORY__" | "COMPLETE" | "CLOSE";
  when?: (args: JourneyTransitionArgs<TContext, TStepId, TEventType>) => boolean | Promise<boolean>;
  effect?: (
    args: JourneyTransitionArgs<TContext, TStepId, TEventType>
  ) => TContext | void | Promise<TContext | void>;
};
```

Selection behavior:

- Transitions are evaluated in array order.
- First matching transition wins.
- Matching means:
  - `from` matches current step or is `"*"`.
  - `event` equals `send(event).type`.
  - `when` is absent or resolves to `true`.

`when` vs `effect`:

- `when` decides if transition is allowed.
- `effect` runs after a transition is selected and can return next context.
- If `effect` returns `undefined`, context is unchanged.

## Events and Payload Typing

`send(...)` accepts:

- Built-in `goTo` event: `{ type: "goTo", to: TStepId, payload? }`
- Your custom events: `{ type: TEventType, payload? }`

You can strongly type payloads with `JourneyEventPayloadMap`:

```ts
import type { JourneyDefinition } from "@rxova/journey-core";

type StepId = "start" | "review";
type Event = "next" | "retry";
type Ctx = { count: number };
type Payloads = {
  next: { origin: "button" | "enter" };
  retry: { attempt: number };
  goTo: { source: "deep-link" };
};

const journey: JourneyDefinition<Ctx, StepId, Event, Payloads> = {
  initial: "start",
  context: { count: 0 },
  steps: { start: {}, review: {} },
  transitions: [{ from: "start", event: "next", to: "review" }]
};
```

## `createJourneyMachine`

```ts
const machine = createJourneyMachine(journey, options?);
```

`options`:

- `history?: JourneyHistoryOptions`
- `persistence?: JourneyPersistenceOptions`

Returned machine (`JourneyMachine`):

- `getSnapshot()`
- `send(event)`
- `updateContext(updater)`
- `clearStepError(stepId?)`
- `reset()`
- `trimHistory(maxHistory?)`
- `clearHistory()`
- `subscribe(listener)`

## Snapshot Contract

`machine.getSnapshot()` returns:

```ts
type JourneySnapshot<TContext, TStepId extends string> = {
  current: TStepId;
  context: TContext;
  history: readonly TStepId[];
  visited: readonly TStepId[];
  status: "running" | "complete" | "closed";
  async: {
    isLoading: boolean;
    byStep: Record<
      TStepId,
      {
        phase: "idle" | "evaluating-when" | "running-effect" | "error";
        eventType: string | null;
        transitionId: string | null;
        error: unknown | null;
      }
    >;
  };
};
```

Field semantics:

- `current`: active step id.
- `context`: current context object.
- `history`: ordered previous-step stack (oldest to newest).
- `visited`: unique ordered list of all reached steps.
- `status`: running or terminal.
- `async.isLoading`: true if any step is currently in async guard/effect phase.
- `async.byStep[step]`: per-step async phase + error state.

## Machine Methods

### `send(event)`

```ts
const result = await machine.send({ type: "next" });
```

Returns:

```ts
type JourneySendResult<TContext, TStepId extends string> = {
  transitioned: boolean;
  transitionId?: string;
  snapshot: JourneySnapshot<TContext, TStepId>;
};
```

Behavior:

- Serialized queue: concurrent sends run in order.
- If status is terminal, returns `{ transitioned: false }`.
- If no transition matches, returns `{ transitioned: false }`.
- For built-in `goTo`, `transitionId` is `"goTo"`.
- For matched transition with `id`, `transitionId` equals that id.

Error behavior:

- If `when` throws/rejects, `send` rejects and current-step async state becomes `error`.
- If `effect` throws/rejects, same behavior.
- Queue remains usable after rejection.

### `updateContext(updater)`

```ts
machine.updateContext((ctx) => ({ ...ctx, dirty: true }));
```

- Synchronously replaces context with updater result.
- Persists snapshot if persistence is enabled.
- Notifies subscribers.

### `clearStepError(stepId?)`

```ts
machine.clearStepError();
machine.clearStepError("details");
```

- Clears async error state for `stepId`, or current step if omitted.
- If step id is unknown, no-op.

### `reset()`

```ts
machine.reset();
```

Resets to:

- `current = journey.initial`
- `context = journey.context`
- `history = []`
- `visited = [initial]`
- `status = "running"`
- fresh idle async state for all steps

Persistence interaction:

- Default `clearOnReset: true` removes persisted state.
- With `clearOnReset: false`, persists reset snapshot.

### `trimHistory(maxHistory?)`

```ts
machine.trimHistory(10);
machine.trimHistory(null); // disable limit for this manual trim call
```

- Trims oldest entries to fit provided max.
- If omitted, uses configured `history.maxHistory`.
- Calls `onOverflow` with reason `"manual"` when trimming occurs.

### `clearHistory()`

```ts
machine.clearHistory();
```

- Sets `history` to `[]`.
- Does not modify `visited`.

### `subscribe(listener)`

```ts
const unsubscribe = machine.subscribe(() => {
  console.log(machine.getSnapshot());
});

unsubscribe();
```

- Listener fires on state changes, including async phase changes.
- Returns unsubscribe function.

## History

### `HISTORY_TARGET`

When a transition uses `to: HISTORY_TARGET`, the machine:

1. Looks at the end of `history`.
2. Pops backward to find the most recent valid step still in `steps`.
3. Moves to that step and removes it from history.
4. If no valid entry exists, stays on current step.

### Max History

Defaults:

- `maxHistory = 50`
- `maxHistory = null` disables trimming.

Trimming happens:

- automatically after transitions (`reason: "auto"`)
- after hydrate (`reason: "hydrate"`)
- by `trimHistory(...)` (`reason: "manual"`)

Overflow callback shape:

```ts
type JourneyHistoryOverflow<TStepId extends string> = {
  previous: readonly TStepId[];
  next: readonly TStepId[];
  trimmed: readonly TStepId[];
  maxHistory: number | null;
  reason: "auto" | "hydrate" | "manual";
};
```

## Persistence

Enable via `options.persistence`:

```ts
const machine = createJourneyMachine(journey, {
  persistence: {
    key: "checkout-journey",
    version: 2,
    clearOnReset: false,
    migrate: (value, persistedVersion) => {
      if (persistedVersion === 1) {
        const old = value as { context?: { oldCount?: number } };
        return {
          current: "start",
          context: { count: old.context?.oldCount ?? 0 },
          history: [],
          visited: ["start"],
          status: "running"
        };
      }

      return value as {
        current: "start" | "review";
        context: { count: number };
        history: Array<"start" | "review">;
        visited: Array<"start" | "review">;
        status: "running" | "complete" | "closed";
      };
    },
    onError: (error) => {
      console.error("persistence failure", error);
    }
  }
});
```

Persisted shape:

```ts
type JourneyPersistedState<TContext, TStepId extends string> = {
  version: number;
  snapshot: {
    current: TStepId;
    context: TContext;
    history: readonly TStepId[];
    visited: readonly TStepId[];
    status: "running" | "complete" | "closed";
  };
};
```

Important behavior:

- Default storage is `localStorage` if available and valid.
- Without valid storage, persistence is disabled (machine still works).
- Invalid persisted data falls back to initial snapshot.
- Invalid history/visited entries are filtered out.
- Missing/empty persisted `visited` is rebuilt and rewritten.
- `snapshot.async` is never persisted.

Hooks:

- `serialize` and `deserialize` let you customize wire format.
- `migrate` runs when persisted version does not equal current version.
- `onError` receives deserialize/set/remove failures.

## Terminal Behavior

Terminal targets:

- `JOURNEY_TERMINAL.COMPLETE` -> status becomes `"complete"`
- `JOURNEY_TERMINAL.CLOSE` -> status becomes `"closed"`

After terminal status:

- `send(...)` calls are no-ops (`transitioned: false`) until `reset()`.

## Determinism and Concurrency

Guaranteed by runtime behavior and tests:

- Concurrent `send(...)` calls are queued and processed in order.
- Transition selection is deterministic (array order).
- Queue continues to process future events after failed sends.
- `visited` remains deterministic and unique.
