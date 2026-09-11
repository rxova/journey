---
title: "Machine surface"
---

`buildMachineSurface` (`src/core/machine.ts`) creates the public machine object once. Its grouped
methods close over a runtime; they do not hold independent copies of journey state.

```text
machine
  getSnapshot()
  controls.*          start, pause, resume, complete, terminate, restart
  navigate.*          goToStepById, goToNextStep, goToPreviousStep,
                      goToLastVisitedStep, registerNextStepInterceptor
  subscriptions.*     subscribeSelector, subscribeEvent
  context.update()
  async.clearError()
  plugins.*           one namespaced entry per plugin
  dispose()
  send()              graph only
```

The object (and every nested group) is referentially stable for the machine's lifetime, so it can
be captured once, passed through props or context, and used in effect dependencies without
re-subscribing. Everything that changes is read from the immutable snapshot.

## Group responsibilities

- **`controls`** — synchronous lifecycle verbs. Each returns a boolean indicating whether the
  status change applied.
- **`navigate`** — Promise-based movement, resolving to an `ok`-discriminated `NavigationResult`.
  Linear machines additionally expose `goToStepByIndex(index)`.
- **`send(event)`** — graph machines only, at the top level. Its presence is the machine-type
  discriminant: linear machines have no event system.
- **`subscriptions`** — synchronous subscribe calls returning unsubscribe functions, delegated to
  the [store](./store).
- **`context.update`** — synchronous context replacement.
- **`async.clearError`** — clears the current step's work or hook error.
- **`plugins`** — the namespaced API record contributed by plugin `setup()` calls.

## Where to next

- [Machine API reference](../api/machine-api)
- [Runtime](./runtime)
- [Plugin host](./plugin-host)
