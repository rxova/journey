---
title: "Stability Contract"
sidebar:
  label: "Stability"
---

Rxova Journey has a typed runtime surface, optional extensions, and a browser-devtools transport. Those pieces do not all carry the same compatibility promise.

This page defines the support contract for long-term adopters.

Journey is currently preparing for a `1.0.0-rc` line. That line is the contract freeze point for the
current runtime model:

- RC builds are expected to be feature-complete and nearly final
- during the `1.0.0-rc` line, only bug fixes, docs fixes, and release-blocking contract fixes should land
- if an RC-breaking change is unavoidable, it must come with explicit migration guidance before the next RC

Once `1.0.0` is released, documented public APIs follow semver. Additive changes belong in minor releases.
Breaking behavior or type changes belong in major releases.

## Core Runtime

`@rxova/journey-core` is the primary stability surface.

For the `1.0.0-rc` line and later, treat these as stable public APIs:

- `createJourneyMachine(...)`
- `JourneyMachine` methods and snapshot shape
- documented transition syntax
- documented lifecycle events
- documented async timeout and error behavior
- published package entrypoints:
  - `@rxova/journey-core`
  - `@rxova/journey-core/persistence`
  - `@rxova/journey-core/execution-paths`

Compatibility expectations:

- additive APIs and bug fixes are preferred in minor/patch releases
- RC-only breaking changes should be rare and only used to fix release-blocking contract problems
- undocumented internals under `src/journey-machine/*` are implementation details, not extension points
- runtime context remains JSON-only, step `meta` remains static definition data, and `updateContext()` remains the state-write API

## React Bindings

`@rxova/journey-react` is a stable public package, but its runtime model matters:

- one `createJourney(...)` call creates one machine instance immediately
- the returned hooks and components stay bound to that machine instance
- `JourneyProvider` does not create isolation; it wires `views`, lifecycle callbacks, and provider-owned startup around that existing runtime

Compatibility expectations:

- the `JourneyRuntime` shape, documented hooks, `JourneyProvider`, and `StepRenderer` are the stable React surface
- runtime ownership semantics are part of the contract, not an implementation accident
- one `createJourney(...)` call still means one eagerly-created machine instance
- `createJourneyFactory(...)` is the stable path for isolated request-scoped or boundary-scoped runtimes
- consumers should not rely on undocumented component tree behavior beyond what the docs describe

For server-rendered or request-scoped applications, create a runtime per request or per owned component boundary when isolation is required.

## Plugins

Plugins are stable as optional public extensions, with narrower guarantees than the base runtime.

Stable contract:

- built-in plugin entrypoints and documented options
- plugin setup hooks documented in public types:
  - `setup`
  - `hydrateSnapshot`
  - `onSnapshotChange`
  - `augmentMachine`
  - `dispose`

Non-contract details:

- internal machine controller structure
- undocumented runtime fields
- assumptions about setup ordering beyond what the public docs describe

Compatibility expectations:

- built-in plugin behavior should evolve additively where possible
- custom plugins should depend only on documented public types and hook timing
- augmenting the machine is supported, but consumers should avoid treating injected fields as if they were part of the base machine API

## Devtools Bridge Protocol

The devtools bridge is a public integration surface with explicit versioning.

Stable contract:

- published bridge API in `@rxova/journey-devtools-bridge`
- documented command and envelope shapes for the current protocol version
- protocol version numbers as the compatibility boundary

Compatibility expectations:

- incompatible wire-shape changes require a protocol version bump
- panel and bridge consumers should upgrade together across protocol-version changes
- additive metadata and additive command/result fields are preferred over shape-breaking mutations

Operational guidance:

- treat the bridge and panel as tooling, not as the primary runtime contract
- production use should be explicit through `enabled` and `commandsEnabled`

## Current Migration Notes

The current runtime model differs from older 0.x material in a few important ways:

- runtime `context` must be JSON-serializable
- step `meta` is static definition data, not mutable runtime state
- transition-side state updates happen through `updateContext(...)`
- React runtimes are instance-bound; use `createJourneyFactory(...)` when isolation matters

## Release Verification

The release process is expected to prove these surfaces separately:

- `pnpm run packages:typecheck`
- `pnpm run docs:check`
- `pnpm run packaging:check`
- `pnpm run pack:smoke`
- `pnpm run size:check`

`pnpm run release:verify` runs the full release-oriented verification chain from one command.
