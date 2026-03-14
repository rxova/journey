---
"@rxova/journey-core": minor
---

This release includes two core changes.

## Added transition timeouts for async guards and effects

`JourneyTransition` config now accepts `timeoutMs?: number`.

The runtime applies that timeout independently to async `when` evaluation and async `effect` execution. When either async
phase exceeds the configured timeout, the machine resolves the send result with `transitioned: false`, preserves the
current step, and emits the normal transition failure path instead of remaining pending indefinitely.

Timeout failures integrate with existing async state behavior:

- async guards move the source step from `evaluating-when` to `error`
- async effects move the source step from `running-effect` to `error`
- `snapshot.async.isLoading` is cleared correctly after timeout
- `transition.error` is emitted with the timeout error
- effect timeouts preserve the active transition id on the send result and step async state

Validation now rejects non-finite `timeoutMs` values such as `NaN`, `Infinity`, and `-Infinity`. `undefined`, `0`, and
negative values remain effectively unbounded and do not activate timeout behavior.

## Refactored typed transition builders into `journey.transitions`

Typed transition helpers now live inside `journey.transitions`:

```ts
transitions: ({ tx, createTransitions }) =>
  createTransitions(
    tx
      .from("start")
      .on("goToNextStep")
      .choose(({ when, otherwise }) => [
        when(({ context }) => context.isVip).to("review"),
        otherwise().to("payment")
      ])
  );
```

This is a breaking DX/API change:

- `journey.transitions` now accepts either a transition array or a typed factory callback
- the preferred inline branching form is `choose(({ when, otherwise }) => [...])`
- root-level runtime exports for `tx` and `createTransitions` were removed from `@rxova/journey-core`
- docs and examples now use the callback-scoped helper pattern

The callback form keeps transition helpers bound to the current journey and preserves selected-event typing for payload-aware guards and effects without requiring temporary builder variables.
