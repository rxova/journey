---
"@rxova/journey-core": major
---

Subtract the ways to do one thing. The v1 contract answered "which step am I on" with five
structural forms for a transition, four places to put pre-move async, ten entry points and seven
plugins. None of that was wrong; all of it was a decision the caller had to make before writing a
flow. This release removes the duplicates and keeps one spelling of each.

## Graph transitions live on the step

The central `transitions` map is gone. A step declares its own outgoing moves under `on`, keyed by
event, in one of three forms — a target id, an ordered candidate array, or an object carrying
declared async work:

<!--
  `commit:` must not start a line in a changeset summary: @changesets/changelog-github
  reads such a line as a commit-override, then builds a GraphQL alias from the value
  after it and fails the whole release. The leading comment keeps it off column zero
  and prettier-ignore stops the formatter reflowing it back. Enforced by
  packages/common/tooling/check-changeset-overrides.ts.
-->
<!-- prettier-ignore -->
```ts
steps: {
  login: { on: { submit: "verify" } },
  verify: {
    on: {
      check: {
        run: ({ handlers }) => handlers.verify(),
        /* stages the result */ commit: ({ result, updateContext }) => updateContext((c) => ({ ...c, ok: result.ok })),
        candidates: [{ to: "done", when: ({ context }) => context.ok }, { to: "verify" }]
      }
    }
  },
  done: {}
}
```

A dangling `from` is now impossible by construction — the step key _is_ the origin. `stay()`,
`allowRollback`, the nested work-authoring callbacks, and result-carrying guards are removed.
Result-carrying guards went for a correctness reason beyond subtraction: they made
`outgoingTransitions[].guard` and `availableEvents` report on a result the snapshot did not have,
so introspection disagreed with what a send would actually do. Guards are now total functions of
context, which is what their documentation always claimed.

## Types are pinned with a bag, not built with a builder

`createGraphJourneyBuilder` and its `build()` are replaced by `withGraphTypes<Bag>()` and
`withLinearTypes<Bag>()`, plus the exported `GraphStep<Bag>`, `GraphDefinition<Bag>` and `Bag`
types for steps authored in their own files. Most definitions need none of it: step ids come from
the `steps` keys and event names from the `on` keys, inferred.

These are standalone functions rather than a `.withTypes` property on each factory. Attaching one
is a module-level side effect, and it defeated tree-shaking badly enough that importing only
`createLinearJourney` pulled the entire graph tier into the bundle.

## One channel for pre-move async

`registerNextStepInterceptor` is removed; `goToNextStep(work?)` is the only way into core's
transactional pre-move async. `goToPreviousStep(n?)` no longer sniffs its argument for work.

## Creating a journey starts it

`autoStart` now defaults to `true`. The trade is worth stating plainly: starting happens inside the
constructor and the initial entry commits synchronously, so the first `stepEnter` has already fired
by the time the factory returns. Pass `{ autoStart: false }` when a subscriber has to see it — it
is the subscribe-then-start order, and saying so out loud beats a default that silently assumed it.

## A plain `subscribe`, and a smaller snapshot

`subscriptions.subscribeSelector` is replaced by `subscriptions.subscribe(listener)`, a plain
per-commit callback. Every non-React caller passed an identity selector; React runs its own
selector layer over `useSyncExternalStore` and never needed core's.

`snapshot.machine` keeps only `outcome`. The six fields removed from it each restated something the
snapshot already said: five were `status === x`, and `isLoading` was a second computation of
`transition.pending`. Read `snapshot.status` and `snapshot.transition` instead — the latter also
carries `phase`, `from` and `to`, so it says _what_ is in flight rather than only that something is.

## Three entry points, four plugins

`.`, `./plugins` and `./connectors/immer`. Every bundled plugin factory now comes from `./plugins`;
tree-shaking is unchanged, since each is still its own module behind a named export.

- **Autosave folded into persistence** as `debounceMs` and `saveOn`. It was the same plugin with a
  timer — same serializer, same adapter contract, same key — so it is a parameter, not a plugin.
  `flushPersisted()` cancels the wait and writes now.
- **Diagnostics became `analyzeStructure(definition)`** on the root entry. Checking a definition
  never needed a runtime; as a plugin it made you create a machine to ask a question about the
  definition you already had.
- **The subscription-enhancer and `./convert` entry points are removed**, along with the headless
  usage pattern and `PluginHost.onStepEnter` / `onStepLeave`.
