---
id: stability
title: Stability contract
---

# Stability contract

The documented V1 public surface follows semantic versioning from `1.0.0`. Stability promises made
by pre-1.0 release candidates do not carry forward: the rc-era factory and flat machine surface
were removed, and `1.0.0` is the baseline contract. See
[rc.2 → 1.0 migration](./pre-1-0-migration).

## What semver covers at 1.0

- **Factories and entry points** — `createLinearJourney`, `createGraphJourney`,
  `createGraphJourneyBuilder`, `MAX_RAISED_EVENTS`, and the exported public types from the main
  entry.
- **Error codes** — `JourneyError.code` is a closed union. Adding a member is a minor change;
  removing or repurposing one is not done within a major. Error **messages** are not covered: match
  on `code`, never on message text.
- **The grouped machine surface** — `getSnapshot`, `controls`, `navigate`, `subscriptions`,
  `context`, `async`, `plugins`, `dispose`, and graph `send`, with their documented return
  contracts (boolean controls, `NavigationResult` navigation).
- **The snapshot shape** — the discriminated `type: "linear" | "graph"` union with status,
  context, transition, history, machine, plugins, and current-step fields as documented.
- **Definition contracts** — the linear step tuple and the graph
  steps/transitions/initial/context/handlers shape, including candidate declaration-order
  selection and sync pure guards.
- **The plugin contract** — `JourneyPlugin`, `PluginHost`, and the observe-only model. Plugins
  stay observe-only throughout V1. Adding new host taps is a non-breaking minor change; removing
  or repurposing an existing tap is never done within a major.
- **Subpath exports** — `convert`, `connectors/immer`, and the seven plugin subpaths
  (`persistence`, `autosave`, `analytics`, `diagnostics`, `execution-paths`, `replay`,
  `subscription-enhancer`) with their documented factories, options, APIs, and helpers.

## Behavioral guarantees

- Graph candidates are selected in declaration order, first enabled match wins.
- Supplied next/previous work runs before commit and may stop movement.
- `onLeave`, `onTransition`, and `onEnter` run after commit in that order and cannot roll it back.
- Timeline pointer moves retrace realized history; appends from the past replace the old future.
- Reaching a last or terminal step does not implicitly complete a journey.
- Plugin contributions remain namespaced and plugins remain observe-only throughout V1.
- Subscriber failures are isolated; `onListenerError` only routes the report.
- The creation-time `persist` option restores a valid non-terminal record at the first `start()`;
  explicit `startAt` wins and `restart()` always begins fresh.
- Disposal is irreversible and later calls are safe.

## Not guaranteed

- Internal module layout, class names, private state, or number of snapshot publications per
  operation. Files under `packages/core/src` are implementation details even when these docs
  explain their architecture; import only from package export paths.
- Object identity for newly derived snapshots, except where a documented selector equality
  function controls notification.
- Automatic cancellation of user-created promises or I/O.
- A bounded history timeline: the timeline is unbounded in 1.0, and a `maxHistory` option is
  planned post-1.0 as a compatible addition. Per-navigation cost grows linearly with timeline
  length — see [History growth](./history#history-growth) for the measured curve and when it
  starts to matter.
- Undocumented details in generated declarations or source files.

## Plugin compatibility

Custom plugins should use only `JourneyPlugin`, `PluginHost`, documented host taps, and the returned
`api`/`deriveSnapshot` contract. Plugin setup order follows the supplied tuple, but plugins should not
depend on another plugin's private state or uncommitted observation timing.

## Devtools

The bridge protocol has its own explicit protocol version. Core semver and bridge wire compatibility
are related but separate boundaries; use the bridge documentation for operation and envelope
support.

## Migration

Code written against any pre-1.0 release candidate must migrate; there is no V1 compatibility
promise for the rc-era factories, flat machine methods, or old snapshot fields. See
[rc.2 → 1.0 migration](./pre-1-0-migration).
