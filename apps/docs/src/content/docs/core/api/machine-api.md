---
id: machine-api
title: Machine API reference
---

# Machine API reference

Linear and graph factories return the same grouped base surface. Graph machines additionally expose
`send`.

## Reading state

### `getSnapshot()`

Returns the latest `LinearSnapshot` or `GraphSnapshot`. See [Snapshot](../snapshot).

```ts
const snapshot = machine.getSnapshot();
```

The machine has no separate computed-state or metadata getters. Derived state and current-step
metadata live in the snapshot.

## Lifecycle controls

Every control returns a boolean indicating whether the state change applied.

| Method                         | Behavior                                                              |
| ------------------------------ | --------------------------------------------------------------------- |
| `controls.start()`             | Start an idle machine and enter its initial step.                     |
| `controls.pause()`             | Pause a running machine when no transition is pending.                |
| `controls.resume()`            | Resume a paused machine.                                              |
| `controls.complete(payload?)`  | Complete a running machine and record an outcome.                     |
| `controls.terminate(payload?)` | Terminate from any non-terminated status and invalidate pending work. |
| `controls.restart()`           | Reset a completed/terminated run and start it again.                  |

```ts
if (!machine.controls.start()) {
  console.log("machine was already started");
}
```

`start()` commits the initial step before returning, then settles `onEnter` asynchronously. Wait
until `snapshot.transition.pending` becomes false before issuing the first navigation. The
[Quickstart](../getting-started) includes a selector-based `waitUntilSettled` helper.

Completion is always explicit. Navigation never auto-completes.

Linear definitions may include a type-only `types` object with `complete` and `terminate` payload
shapes. Those shapes constrain the control arguments and narrow `snapshot.machine.outcome`.

## Navigation

All navigation methods return `Promise<NavigationResult<TStepId>>`.

### `navigate.goToStepById(id)`

Linear journeys may jump to any declared id. Graph journeys require an enabled outgoing transition
whose destination is that id.

### `navigate.goToPreviousStep(work?)` / `navigate.goToPreviousStep(n, work?)`

Move the timeline pointer back by at least one entry, clamping to the beginning. Optional work uses
the same pre-commit contract as next navigation.

### `navigate.goToNextStep(work?)`

Move through an existing forward timeline entry. At the timeline tip, linear journeys move to the
next declared step; graph journeys return `"out-of-bounds"`.

### Navigation work

```ts
await machine.navigate.goToNextStep({
  run: async ({ snapshot, from, to, direction }) => {
    return api.submit(snapshot.context);
  },
  commit: ({ result, updateContext }) => {
    updateContext((context) => ({ ...context, submissionId: result.id }));
  }
});
```

`run` is awaited while the source remains current. If it fails, navigation returns `reason:
"error"`. `commit` must be synchronous; its context updates publish atomically with movement.

Use `snapshot.machine.isLoading` as the normal UI-level loading flag. Inspect
`snapshot.transition` for phase details and `snapshot.currentStep.async` for the current entry's
success or error state.

### `navigate.goToLastVisitedStep()`

Move the pointer to the realized timeline tip.

On linear journeys, `goToStepById` is an ungated escape hatch for occasional direct jumps. Prefer
graph mode when explicit jumps or branches are part of normal domain behavior.

### Result

```ts
type NavigationResult<TStepId extends string> =
  | { readonly ok: true; readonly from: TStepId | null; readonly to: TStepId }
  | {
      readonly ok: false;
      readonly reason: NavigationFailureReason;
      readonly error?: unknown;
    };
```

Failure reasons are `error`, `transitioning`, `not-running`, `invalid-target`,
`no-enabled-transition`, `out-of-bounds`, `no-op`, and `disposed`.

## Graph `send(type, payload?)`

Graph `send` selects the first enabled candidate for the current step and event type.

```ts
await machine.send("SUBMIT", { email: "ada@example.com" });
await machine.send("CANCEL");
```

Declared discriminated-union events produce exact payload tuples. Without a declared event union,
the fallback signature is `(type: string, payload?: unknown)`.

## Context

### `context.update(updater)`

Synchronously replaces context and publishes a snapshot plus `contextChange` event.

```ts
machine.context.update((context) => ({ ...context, name: "Ada" }));
```

After disposal it is a no-op. The runtime does not enforce serializability, though persistence and
replay integrations require serializable values.

### `async.clearError()`

Clears the current step's navigation-work or lifecycle-effect error. It is a no-op when no error is
present.

## Subscriptions

### `subscriptions.subscribeSelector(selector, listener, equals?)`

Calls `listener` when the selected value changes according to `Object.is` or the supplied equality
function.

```ts
const stop = machine.subscriptions.subscribeSelector(
  (snapshot) => snapshot.currentStep?.id,
  (id) => render(id)
);
```

### `subscriptions.subscribeEvent(event, listener)`

Subscribes to one of `stepEnter`, `stepLeave`, `statusChange`, `contextChange`,
`navigationBlocked`, or `error`.

```ts
const stop = machine.subscriptions.subscribeEvent("navigationBlocked", ({ reason, from, to }) => {
  console.log({ reason, from, to });
});
```

Both methods return an idempotent unsubscribe function.

## Hooks

### Step `onLeave(args)`

Runs after commit as an awaited source-step side effect. It may be asynchronous and cannot block.

### Graph transition `when(args)`

Runs synchronously with `{ context, handlers }`. It must stay pure because snapshot derivation also
evaluates it.

### Graph transition `onTransition(args)`

Runs post-commit after source `onLeave` and before destination `onEnter`. It may be asynchronous and
cannot block.

### Step `onEnter(args)`

Runs post-commit after `onTransition`. It may be asynchronous and cannot block.

### Hook arguments

```ts
{
  (snapshot, from, to, event, updateContext, raise);
}
```

`event` is `null` unless a graph transition caused the move. `raise(event)` queues graph work after
settle and is a no-op in linear journeys.

## Plugins

Plugin APIs and snapshot extensions are namespaced by plugin name:

```ts
machine.plugins.analytics.trackAnalyticsEvent("checkout_opened");
machine.getSnapshot().plugins.autosave;
```

## `dispose()`

Irreversibly drops listeners, plugin disposal callbacks, and pending raised events. Later methods
are safe no-ops; navigation returns `reason: "disposed"`.
