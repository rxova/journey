# @rxova/journey-common

Internal shared utilities and repo tooling for [`@rxova/journey`](https://github.com/rxova/journey). **Not published.**

This package is `private: true` and is consumed only through the workspace. It is nonetheless held to the same bar as the published packages — full TSDoc on the public surface, per-file coverage gates, no dependencies — so that extracting it later is a packaging change rather than a rewrite.

## Layout

| Path       | Ships as part of the package | Purpose                                                                           |
| ---------- | ---------------------------- | --------------------------------------------------------------------------------- |
| `src/`     | yes                          | Runtime utilities imported by `core`, `react`, `devtools-bridge`, `apps/devtools` |
| `tooling/` | no                           | Repo build, release, and docs scripts run via `node --import tsx`                 |

Only `src/` is part of the package's API. `tooling/` lives here for colocation and is excluded from `tsconfig.build.json` and from coverage.

Tests sit in a `__tests__` directory alongside the code they cover — `src/__tests__/` and `tooling/__tests__/` — matching the rest of the repo. Tests import through the package's own entry points (`@rxova/journey-common/serialization`) rather than relative paths, so the suite exercises the published `exports` map rather than bypassing it.

## Design rules

Everything in `src/` obeys three constraints, and they are the reason this package exists rather than the code living in `core`:

1. **No dependencies, including on other workspace packages.** `src/` imports nothing but itself.
2. **No ambient assumptions.** Every global is feature-detected — `window`, `process`, `console`, and `structuredClone` may all be absent. The utilities run in Node, the browser, a web worker, and an extension service worker.
3. **Never throw on the diagnostic path.** `serialization` and `dev` run while the caller is already handling a failure. They degrade to a lossy result instead of turning a recoverable problem into a lost one.

A fourth rule applies to `serialization` specifically: **never silently drop.** A reader of a devtools payload cannot tell an omission from an absence, so an omission is a lie. `cloneForTransport` documents exactly what it converts and what it accepts as lossy; the guarantees are enforced by property tests in `src/__tests__/serialization-fuzz.test.ts` rather than examples alone, because "never throws for any input" is a claim about all inputs.

Related: values are identified by their built-in tag, never by `instanceof`. Anything arriving from an iframe, a worker, an extension port, or `structuredClone` carries a foreign realm's prototype, so `x instanceof Map` is false for a real Map. That is this module's normal input, not an edge case.

## Entry points

Consumers import subpaths, not the barrel:

```ts
import { isRecord } from "@rxova/journey-common/predicates";
```

| Subpath          | Exports                                                                                                           |
| ---------------- | ----------------------------------------------------------------------------------------------------------------- |
| `/predicates`    | `isRecord`, `isPlainObject`                                                                                       |
| `/serialization` | `cloneForTransport`, `serializeError`, `serializeTransportError`, `SerializedError`                               |
| `/bindings`      | `createSnapshotSource`, `createSelectorCache`, `JourneyReadable`, `SnapshotSource`, `EqualityFn`, `SelectorCache` |
| `/dev`           | `isDevelopmentEnvironment`, `warnInDevelopment`, `resolveNonProductionEnvironment`, `NonProductionBundlerEnv`     |
| `/origin`        | `resolveWindowTargetOrigin`, `isExpectedWindowOrigin`                                                             |

The `.` barrel re-exports all of the above. It exists for completeness; prefer subpaths so a consumer only pulls in what it uses.

### A note on `bindings`

`bindings` is framework-agnostic on purpose. A wrapper is mostly glue, but multiplexing one machine subscription across many views and caching a derived selection are pure logic and identical for React, Vue, or Angular. They live here so the second wrapper inherits them instead of reimplementing them, subtly differently.

### A note on `dev`

`dev` exports two environment resolvers that answer different questions and have deliberately opposite defaults: `isDevelopmentEnvironment` is permissive (unset `NODE_ENV` means "warn"), `resolveNonProductionEnvironment` is conservative (unset means "assume production"). Permissive for output, conservative for behaviour. See the module header for why aligning them would break one of those properties.

## Scripts

```bash
pnpm --filter @rxova/journey-common test        # src + tooling suites
pnpm --filter @rxova/journey-common coverage    # per-file thresholds over src/
pnpm --filter @rxova/journey-common typecheck
```

`coverage` is wired into the repo-wide `pnpm packages:coverage` gate, which `release:verify` runs.

## If this is ever extracted

The code is already standalone; the packaging is not. Extracting it means:

- adding a dual ESM/CJS build (mirror `packages/devtools-bridge/scripts/build.ts` — the current `tsconfig.build.json` emits declarations only), and pointing `exports` at `dist` instead of `src`;
- setting `private: false`, a real version, `files`, `engines`, `repository`, `publishConfig`, and a `LICENSE`;
- adding `publint`, `attw`, and `size` scripts. `attw` currently reports node10 resolution failure and ESM-only, both of which the dual build resolves;
- moving `tooling/` out, since it is repo infrastructure and must not ship.

Flipping `private` alone is enough to enrol the package in `docs:api:check`, `pack:smoke`, `publint`, and `attw`, so do the build first.
