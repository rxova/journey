---
id: stability
title: Stability contract
---

# Stability contract

The documented V1 public surface follows semantic versioning after `1.0.0`.

## Core runtime

The supported Core surface is:

- `createLinearJourney`, `createGraphJourney`, and `createGraphJourneyBuilder`;
- exported public types and `MAX_RAISED_EVENTS` from the main entry;
- the grouped machine API and graph `send`;
- linear and graph snapshot contracts;
- documented step hooks, graph transitions, results, and named subscription events;
- `linearToGraphDefinition` from the convert entry;
- documented plugin entry points, options, APIs, helpers, and plugin host contract.

Files and classes under `packages/core/src` are implementation details even when their architecture
is explained in these docs. Import only from package export paths.

## Behavioral guarantees

- Graph candidates are selected in declaration order, first enabled match wins.
- Supplied next/previous work runs before commit and may stop movement.
- `onLeave`, `onTransition`, and `onEnter` run after commit in that order and cannot roll it back.
- Timeline pointer moves retrace realized history; appends from the past replace the old future.
- Reaching a last or terminal step does not implicitly complete a journey.
- Plugin contributions remain namespaced and plugins remain observe-only throughout V1.
- Disposal is irreversible and later calls are safe.

## Not guaranteed

- Internal module layout, class names, private state, or number of snapshot publications per
  operation.
- Object identity for newly derived snapshots, except where a documented selector equality function
  controls notification.
- Automatic cancellation of user-created promises or I/O.
- Automatic hydration of persisted runtime history.
- Undocumented details in generated declarations or source files.

## Plugin compatibility

Custom plugins should use only `JourneyPlugin`, `PluginHost`, documented host taps, and the returned
`api`/`deriveSnapshot` contract. Plugin setup order follows the supplied tuple, but plugins should not
depend on another plugin's private state or uncommitted observation timing.

## Devtools

The bridge protocol has its own explicit protocol version. Core semver and bridge wire compatibility
are related but separate boundaries; use the bridge documentation for command and envelope support.

## Migration

Code written against the pre-V1 controller API must migrate; there is no V1 compatibility promise
for `createJourneyMachine`, `createHeadlessJourney`, flat machine methods, or old snapshot fields.
See [Pre-1.0 migration](./pre-1-0-migration).
