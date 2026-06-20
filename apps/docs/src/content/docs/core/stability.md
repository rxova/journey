---
title: Stability contract
sidebar_label: Stability
---

# Stability contract

Journey has a typed runtime surface, optional plugins, and a browser-devtools transport — and they
don't all carry the same compatibility promise. This page is the support contract for long-term
adopters.

Journey is preparing the `1.0.0-rc` line, which is the contract freeze point for the current runtime
model:

- RC builds are feature-complete and close to final;
- during the RC line, only bug fixes, docs fixes, and release-blocking contract fixes should land;
- if an RC-breaking change is unavoidable, it ships with explicit migration guidance.

Once `1.0.0` is out, documented public APIs follow semver: additive changes in minors, breaking
changes in majors.

## Core runtime

`@rxova/journey-core` is the primary stability surface. For the RC line and later, treat these as
stable:

- the journey factories — `createLinearJourney`, `createGraphJourney`, `createHeadlessJourney`
  (`createJourneyMachine` remains exported as a deprecated alias);
- `JourneyMachine` methods and the snapshot shape;
- the documented transition syntax, lifecycle events, and async timeout/error behavior;
- the published entry points: `@rxova/journey-core`, `@rxova/journey-core/persistence`,
  `@rxova/journey-core/execution-paths`.

Expectations:

- additive APIs and bug fixes belong in minor/patch releases;
- RC-only breaking changes should be rare and reserved for release-blocking contract problems;
- undocumented internals under `src/journey-machine/*` are implementation details, not extension
  points;
- runtime context stays JSON-only, step `meta` stays static definition data, and `updateContext()`
  stays the state-write API.

## React bindings

`@rxova/journey-react` is a stable public package, but its ownership model is part of the contract:

- one `createJourney(...)` call creates one machine instance, immediately;
- the returned hooks and components stay bound to that instance;
- `JourneyProvider` wires `views`, lifecycle callbacks, and startup around that runtime — it doesn't
  create isolation.

The stable React surface is the `JourneyRuntime` shape, the documented hooks, `JourneyProvider`, and
`StepRenderer`. For request-scoped or boundary-scoped isolation, use `createJourneyFactory(...)` and
create a runtime per request or per owned boundary.

## Plugins

Plugins are stable public extensions, with narrower guarantees than the base runtime.

**Contract:** the built-in plugin entry points and documented options, plus the documented setup
hooks — `setup`, `hydrateSnapshot`, `onSnapshotChange`, `augmentMachine`, `dispose`.

**Not contract:** internal machine controller structure, undocumented runtime fields, and any
assumption about setup ordering beyond what the docs describe.

Custom plugins should depend only on documented public types and hook timing. Augmenting the machine
is supported, but don't treat injected fields as if they were part of the base machine API.

## Devtools bridge protocol

The devtools bridge is a public integration surface with explicit versioning. The contract is the
published API in `@rxova/journey-devtools-bridge`, the documented command and envelope shapes for the
current protocol version, and the protocol version number as the compatibility boundary.

Incompatible wire-shape changes require a protocol version bump; panel and bridge consumers upgrade
together. Treat the bridge and panel as tooling, and gate production use explicitly through `enabled`
and `commandsEnabled`.

## Migration notes

The current runtime differs from older 0.x material in a few ways that matter:

- runtime `context` must be JSON-serializable;
- step `meta` is static definition data, not mutable runtime state;
- transition-side state updates happen through `updateContext(...)`;
- React runtimes are instance-bound — use `createJourneyFactory(...)` when isolation matters.

See [Pre-1.0 migration](/docs/core/pre-1-0-migration) for the upgrade steps.

## Release verification

The release process proves these surfaces separately:

```bash
pnpm run packages:typecheck
pnpm run docs:check
pnpm run packaging:check
pnpm run pack:smoke
pnpm run size:check
```

`pnpm run release:verify` runs the full chain from one command.
