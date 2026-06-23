---
title: Machine API reference
sidebar_label: Machine API
---

# Machine API reference

Every factory — `createGraphJourney`, `createLinearJourney`, `createHeadlessJourney`, and the graph
builder's `build()` output — returns the same `JourneyMachine` object. This page documents **every
method on that object** and **every argument your definition callbacks receive** (`when`,
`updateContext`, `onEnter`/`onLeave`, `effect.run`, `after`), with signatures, argument tables, and
short examples.

In React, you rarely call these directly — `useJourneyApi()` exposes the same driving methods and the
hooks wrap the subscriptions — but the shapes are identical.

The examples below assume this machine:

```ts
import { createGraphJourney } from "@rxova/journey-core";

type Context = { name: string; couponCode: string | null };
type StepId = "details" | "review" | "done";
type Events = { type: "applyCoupon"; payload: { code: string } };

const machine = createGraphJourney<Context, StepId, Events>({
  initial: "details",
  context: { name: "", couponCode: null },
  steps: { details: {}, review: {}, done: {} },
  transitions: {
    details: { goToNextStep: [{ to: "review" }], applyCoupon: [{ to: "review" }] },
    review: { completeJourney: true }
  }
});
```

---

## Reading state

### `getSnapshot()`

`() => JourneySnapshot<TContext, TStepId>` — returns the current immutable (frozen) snapshot.

```ts
const snap = machine.getSnapshot();
snap.currentStepId; // "details"
snap.context.name; // ""
snap.status; // "idled" | "running" | "completed" | "terminated"
```

The snapshot shape:

| Field           | Type                                                                     | Description                                                                              |
| --------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `currentStepId` | `TStepId`                                                                | The active step.                                                                         |
| `history`       | `{ timeline: readonly TStepId[]; index: number }`                        | Realized path and the current position in it.                                            |
| `context`       | `TContext`                                                               | JSON-only runtime data.                                                                  |
| `visited`       | `Record<TStepId, boolean>`                                               | Which steps have been entered at least once.                                             |
| `status`        | `"idled" \| "running" \| "completed" \| "terminated"`                    | Lifecycle status.                                                                        |
| `async`         | `{ isLoading: boolean; byStep: Record<TStepId, JourneyStepAsyncState> }` | Per-step async phase. `phase` is `"idle" \| "evaluating-when" \| "invoking" \| "error"`. |

### `getComputed()`

`() => JourneyComputed<TStepId>` — derived, mode-aware view state.

```ts
const c = machine.getComputed();
c.mode; // "linear" | "graph" | "headless"
c.activeStepId; // "details"
c.isLoading; // false
```

Always present: `mode`, `activeStepId`, `activeStepIndex`, `visitedStepCount`, `isLoading`, `isIdle`,
`isRunning`, `isComplete`, `isTerminated`, `isInitialStep`. **Linear mode only** additionally provides
`stepCount`, `journeyLength`, `isFirstStep`, `isLastStep`, and `stepOrder` (they are `undefined` in
graph/headless mode).

### `getStepMeta(stepId)`

`(stepId: TStepId) => TStepMeta | undefined` — returns a clone of the static `meta` declared on a step.

```ts
machine.getStepMeta("review"); // your StepMeta, or undefined
```

---

## Driving the machine

All driving methods are **async and serialized** through an internal queue — calls never interleave.
Navigation methods resolve to a `JourneySendResult`; the `updateContext`/`clearStepError`/`reset`
methods resolve to a `JourneySnapshot`.

`JourneySendResult` shape:

| Field          | Type                                 | Description                                          |
| -------------- | ------------------------------------ | ---------------------------------------------------- |
| `transitioned` | `boolean`                            | Whether a transition actually committed.             |
| `transitionId` | `string \| undefined`                | Id of the committed transition, when one ran.        |
| `label`        | `string \| undefined`                | Label of the committed transition, if declared.      |
| `error`        | `unknown \| undefined`               | A guard/lifecycle error captured during the attempt. |
| `snapshot`     | `JourneySnapshot<TContext, TStepId>` | The snapshot after the attempt.                      |

### `startJourney()`

`() => Promise<JourneySnapshot>` — moves `idled → running` and fires the initial step's `effect`/`after`
timers. Idempotent: a second call while already running is a no-op (initial effects fire exactly once).

```ts
await machine.startJourney();
```

### `send(event)`

`(event: JourneySendEvent<TStepId, TEvents>) => Promise<JourneySendResult>` — dispatches an event.
Events are a discriminated union of `{ type; payload? }`. A declared payload is passed through to
`when`/`updateContext` as `event.payload`.

```ts
await machine.send({ type: "applyCoupon", payload: { code: "VIP50" } });
await machine.send({ type: "goToNextStep" });
// goToStepById is the one built-in that also takes a stepId:
await machine.send({ type: "goToStepById", stepId: "done" });
```

If no enabled transition matches, the event is dropped (and routed to `onNoMatch` if configured).

### Navigation convenience methods

| Method                       | Signature                                         | Description                                                     |
| ---------------------------- | ------------------------------------------------- | --------------------------------------------------------------- |
| `goToNextStep()`             | `() => Promise<JourneySendResult>`                | Advance via the `goToNextStep` event.                           |
| `goToPreviousStep(steps?)`   | `(steps?: number) => Promise<JourneySendResult>`  | Step back `steps` entries in history (default `1`).             |
| `goToLastVisitedStep()`      | `() => Promise<JourneySendResult>`                | Jump forward to the most recently visited step.                 |
| `goToStepById(stepId)`       | `(stepId: TStepId) => Promise<JourneySendResult>` | Jump to a specific step (requires a `goToStepById` transition). |
| `goToStepByIndex(index)`     | `(index: number) => Promise<JourneySendResult>`   | **Linear machines only** — jump to a step by its order index.   |
| `completeJourney(payload?)`  | `(payload?) => Promise<JourneySendResult>`        | End with `"completed"` status.                                  |
| `terminateJourney(payload?)` | `(payload?) => Promise<JourneySendResult>`        | End with `"terminated"` status.                                 |

```ts
await machine.goToPreviousStep(); // back one
await machine.goToPreviousStep(2); // back two
await machine.completeJourney();
```

### `updateContext(updater)`

`(updater: (context: TContext) => TContext) => Promise<JourneySnapshot>` — replaces context **without
navigating**. Use this for "do something without going somewhere" (Journey forbids self-transitions).
The updater receives the current context and must return the next one.

```ts
await machine.updateContext((ctx) => ({ ...ctx, name: "Ada" }));
```

### `clearStepError(stepId?)`

`(stepId?: TStepId) => Promise<JourneySnapshot>` — clears the captured async `error` and resets the
step's async `phase` to `idle`. Omit `stepId` to clear the current step.

### `resetJourney()`

`() => Promise<JourneySnapshot>` — cancels in-flight async work and returns the machine to its initial
`idled` snapshot (fresh context clone, empty timeline).

### `dispose()`

`() => void` — tears the machine down: cancels timers/effects, aborts in-flight lifecycle work,
disposes plugins, and makes further calls no-ops (with a dev warning).

---

## Subscriptions

Every subscribe method returns an **unsubscribe** function `() => void`.

### `subscribe(listener)`

`(listener: () => void) => () => void` — fires on every committed snapshot change. Read the new value
with `getSnapshot()`.

```ts
const off = machine.subscribe(() => render(machine.getSnapshot()));
off(); // stop listening
```

### `subscribeSelector(selector, listener, equalityFn?)`

`<TSelected>(selector: (snapshot) => TSelected, listener: (next: TSelected, previous: TSelected) => void, equalityFn?: (a: TSelected, b: TSelected) => boolean) => () => void`
— fires only when the selected slice changes (default equality is `Object.is`).

```ts
machine.subscribeSelector(
  (s) => s.currentStepId,
  (next, previous) => console.log(`${previous} → ${next}`)
);
```

### `subscribeEvent(listener)`

`(listener: (event: JourneyObservationEvent<TStepId, TEvents>) => void) => () => void` — the full
observation stream. Each event has a `type` and a `timestamp`. Event types: `journey.start`,
`journey.reset`, `journey.completed`, `journey.terminated`, `step.enter`, `step.exit`,
`transition.start`, `transition.success`, `transition.error`, `lifecycle.error`,
`navigation.previous`, `navigation.lastVisited`.

```ts
machine.subscribeEvent((event) => {
  if (event.type === "transition.success") {
    analytics.track("step_changed", { to: event.to });
  }
});
```

### Typed lifecycle subscriptions

Narrow helpers for the four journey-lifecycle moments — each listener receives only the matching event:

| Method                         | Listener event                              |
| ------------------------------ | ------------------------------------------- |
| `subscribeStart(listener)`     | `JourneyStartObservationEvent<TStepId>`     |
| `subscribeReset(listener)`     | `JourneyResetObservationEvent<TStepId>`     |
| `subscribeComplete(listener)`  | `JourneyCompleteObservationEvent<TStepId>`  |
| `subscribeTerminate(listener)` | `JourneyTerminateObservationEvent<TStepId>` |

```ts
machine.subscribeComplete((event) => {
  console.log("done at", event.stepId, event.timestamp);
});
```

---

## Definition callback arguments

These are the functions you write **inside the definition** (transitions and steps). This is where
`event.payload`, `context`, `signal`, and `handlers` reach you.

### `when({ … })` — transition guard

Returns `boolean | Promise<boolean>`; a falsy/rejected result skips the edge. Receives:

| Arg        | Type                                                 | Description                                                                              |
| ---------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `snapshot` | `JourneySnapshot<TContext, TStepId>`                 | Full current snapshot.                                                                   |
| `context`  | `Readonly<TContext>`                                 | Current context (frozen — clone to derive values).                                       |
| `from`     | `TStepId`                                            | The step the edge leaves.                                                                |
| `timeline` | `readonly TStepId[]`                                 | Realized history path.                                                                   |
| `index`    | `number`                                             | Current history index.                                                                   |
| `signal`   | `AbortSignal`                                        | Aborts if the step is left, reset, or disposed mid-evaluation. Honor it in async guards. |
| `handlers` | `THandlers`                                          | Injected handler functions (from `definition.handlers`).                                 |
| `event`    | `{ type; payload? }` (narrowed to this edge's event) | The event being evaluated.                                                               |

```ts
applyCoupon: [
  {
    to: "review",
    when: ({ event, context, signal }) => {
      // event.payload is { code: string } here
      return verifyCoupon(event.payload.code, { signal });
    }
  }
];
```

### `updateContext({ … })` — transition reducer

Returns the next `TContext`. A **synchronous, pure reducer** — note it does **not** receive `signal` or
`handlers` (do async work in `when` or an `effect`). Receives:

| Arg        | Type                                 | Description               |
| ---------- | ------------------------------------ | ------------------------- |
| `snapshot` | `JourneySnapshot<TContext, TStepId>` | Full current snapshot.    |
| `context`  | `Readonly<TContext>`                 | Current context.          |
| `from`     | `TStepId`                            | The step the edge leaves. |
| `timeline` | `readonly TStepId[]`                 | Realized history path.    |
| `index`    | `number`                             | Current history index.    |
| `event`    | `{ type; payload? }` (narrowed)      | The triggering event.     |

```ts
applyCoupon: [
  {
    to: "review",
    updateContext: ({ context, event }) => ({ ...context, couponCode: event.payload.code })
  }
];
```

### `onEnter` / `onLeave({ … })` — step & transition lifecycle

Run **after** navigation commits (post-commit side effects — not transactional). Return
`void | Promise<void>`; errors are reported via `onLifecycleError` and a `lifecycle.error` event, not
rolled back. Receives:

| Arg            | Type                                    | Description                                      |
| -------------- | --------------------------------------- | ------------------------------------------------ |
| `snapshot`     | `JourneySnapshot<TContext, TStepId>`    | Snapshot after the commit.                       |
| `context`      | `Readonly<TContext>`                    | Current context.                                 |
| `from`         | `TStepId`                               | The step being left/entered from.                |
| `to`           | `TStepId \| "COMPLETE" \| "TERMINATED"` | The destination.                                 |
| `event`        | `{ type; payload? }`                    | The triggering event.                            |
| `transitionId` | `string \| null`                        | Id of the transition, when one drove the change. |
| `label`        | `string \| undefined`                   | Transition label, if declared.                   |
| `handlers`     | `THandlers`                             | Injected handlers.                               |
| `signal`       | `AbortSignal`                           | Aborts on exit/reset/dispose.                    |
| `dispatch`     | `(event) => Promise<JourneySendResult>` | Send a follow-up event from within the callback. |

```ts
review: {
  onEnter: async ({ context, dispatch, signal }) => {
    await analytics.track("review_viewed", { coupon: context.couponCode }, { signal });
    if (!context.name) await dispatch({ type: "goToPreviousStep" });
  };
}
```

### `effect.run({ … })` — declarative async on entry

An effect runs when its step is entered; its result routes to `onResolved` / `onRejected`. `run`
returns `TOutput | Promise<TOutput>` and receives:

| Arg        | Type                                 | Description                                                           |
| ---------- | ------------------------------------ | --------------------------------------------------------------------- |
| `snapshot` | `JourneySnapshot<TContext, TStepId>` | Snapshot on entry.                                                    |
| `context`  | `Readonly<TContext>`                 | Current context.                                                      |
| `from`     | `TStepId`                            | The step the effect is attached to.                                   |
| `handlers` | `THandlers`                          | Injected handlers.                                                    |
| `signal`   | `AbortSignal`                        | Aborts when the step is left, reset, or disposed (or on `timeoutMs`). |

```ts
steps: {
  review: {
    effect: {
      run: ({ context, signal }) => fetchQuote(context.couponCode, { signal }),
      timeoutMs: 5000,
      onResolved: { to: "done", updateContext: ({ context, output }) => ({ ...context, ...output }) },
      onRejected: { to: "review", updateContext: ({ context, error }) => ({ ...context }) }
    }
  }
}
```

The branch `updateContext` callbacks receive a smaller arg set:

- `onResolved.updateContext` → `{ snapshot, context, from, output }` (where `output` is the awaited `run` result)
- `onRejected.updateContext` → `{ snapshot, context, from, error }`

### `after[ms].updateContext({ … })` — delayed transition

A step's `after` maps a delay (ms) to a transition that fires once the step has been active that long.
Its optional `updateContext` receives `{ snapshot, context, from }` and returns the next context.

```ts
steps: {
  review: {
    after: { 10000: { to: "done", updateContext: ({ context }) => ({ ...context }) } }
  }
}
```

---

## Plugin-added methods

Plugins augment the machine with extra methods. When a plugin is registered, its methods appear on the
returned machine (fully typed):

| Plugin                                                         | Adds                                                                          |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| [`persistence`](/docs/core/persistence)                        | (no machine methods — hydrates/persists transparently)                        |
| [`autosave`](/docs/core/autosave)                              | `getAutosaveState()`, `flushAutosave()`, `clearAutosave()`                    |
| [`replay`](/docs/core/plugins/replay-plugin)                   | `getReplaySession()`, `exportReplaySession(options?)`, `clearReplaySession()` |
| [`analytics`](/docs/core/plugins/analytics-plugin)             | `trackAnalyticsEvent(name, payload?)`                                         |
| [`diagnostics`](/docs/core/plugins/diagnostics-plugin)         | `getDiagnostics(options?)`                                                    |
| [`execution-paths`](/docs/core/plugins/execution-paths-plugin) | `getExecutionPaths(options?)`                                                 |

See [Transitions syntax](/docs/core/api/transitions-syntax) for how transitions are declared and
[TypeScript](/docs/core/typescript) for the generics behind these signatures.
