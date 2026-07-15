---
id: pre-1-0-migration
title: Pre-1.0 migration
---

# Pre-1.0 migration

V1 replaces the previous generic/controller runtime with two factories over one shared snapshot and
event engine. This is a breaking API migration, not a compatibility alias.

## Factory changes

| Before                             | V1                                                           |
| ---------------------------------- | ------------------------------------------------------------ |
| `createJourneyMachine(...)`        | `createLinearJourney(...)` or `createGraphJourney(...)`      |
| `createHeadlessJourney(...)`       | Usually `createLinearJourney(...)` plus direct id navigation |
| Linear order in `transitions`      | Linear order in `steps`                                      |
| Graph transitions nested by source | Event-keyed transition map with explicit `from` and `to`     |

### Linear

```ts
const machine = createLinearJourney({
  context,
  steps: ["intro", { id: "details", metadata: { title: "Details" } }, "done"] as const
});
```

### Graph

```ts
const machine = createGraphJourney({
  initial: "form",
  context,
  steps: { form: {}, review: {}, done: {} },
  transitions: {
    SUBMIT: { from: "form", to: "review" },
    APPROVE: { from: "review", to: "done" }
  }
});
```

## Machine method changes

| Before                                     | V1                                             |
| ------------------------------------------ | ---------------------------------------------- |
| `startJourney()`                           | `controls.start()`                             |
| `pauseJourney()` / `resumeJourney()`       | `controls.pause()` / `controls.resume()`       |
| `completeJourney()` / `terminateJourney()` | `controls.complete()` / `controls.terminate()` |
| `resetJourney()`                           | `controls.restart()` from a terminal status    |
| `goToNextStep()`                           | `navigate.goToNextStep()`                      |
| `goToPreviousStep(n)`                      | `navigate.goToPreviousStep(n)`                 |
| `goToStepById(id)`                         | `navigate.goToStepById(id)`                    |
| `goToLastVisitedStep()`                    | `navigate.goToLastVisitedStep()`               |
| `updateContext(updater)`                   | `context.update(updater)`                      |
| `subscribeSelector(...)`                   | `subscriptions.subscribeSelector(...)`         |
| `subscribeEvent(listener)`                 | `subscriptions.subscribeEvent(name, listener)` |
| `send({ type, payload })`                  | `send(type, payload)` on graph machines        |

Controls now return booleans. Navigation and graph sends return the `ok`-discriminated
`NavigationResult`.

## Snapshot changes

| Before                 | V1                                                         |
| ---------------------- | ---------------------------------------------------------- |
| `currentStepId`        | `currentStep?.id`                                          |
| `meta` / `getStepMeta` | Current `currentStep.metadata`; definition for other steps |
| `history.index`        | `history.currentIndex`                                     |
| separate `visited`     | `history.visited`                                          |
| `getComputed()`        | Derived fields in the discriminated snapshot               |
| per-step async map     | Current entry state at `currentStep.async`                 |
| `idled`                | `idle`                                                     |

Narrow `snapshot.type` before reading linear order fields or graph availability fields.

## Hook and transition changes

- `when` is now synchronous and receives only `{ context, handlers }`.
- Async pre-commit validation belongs in step `onLeave`.
- `onLeave` can block; `onTransition` and `onEnter` are post-commit effects.
- Transition `updateContext`, `effect`, `after`, labels, ids, and per-transition timeouts are gone.
- Use hook `updateContext` for writes associated with a hook.
- Use hook `raise` for graph follow-up events after settle.
- The runtime option `defaultTimeoutMs` applies to every async hook.

## Plugin changes

Old hydrate/intercept/augment hooks are gone. V1 plugins receive an observe-only `PluginHost` and
return namespaced contributions:

```ts
{
  name: "example",
  setup(host) {
    return {
      api: { /* machine.plugins.example */ },
      deriveSnapshot(snapshot, previous) { /* snapshot.plugins.example */ }
    };
  }
}
```

Built-in plugin methods now live under `machine.plugins.<name>`.

## Upgrade order

1. Choose linear or graph and migrate the definition shape.
2. Move machine calls into their V1 groups and change graph send syntax.
3. Replace old snapshot selectors with the new discriminated shape.
4. Move async guards to `onLeave` and post-commit work to `onTransition`/`onEnter`.
5. Update plugin access and any custom plugin implementation.
6. Re-test completion, history branching, and restore behavior; none are implicit.
