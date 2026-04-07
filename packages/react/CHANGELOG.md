# @rxova/journey-react

## 1.0.0-rc.2

### Patch Changes

- 5bc391a: Remove `JourneyProvider` lifecycle callback props in favor of event subscriptions and hooks.
- 4a16dd2: Rename the React startup API from `start()` to `startJourney()`.
- 882d5a5: Add useStepApi for step-scoped custom event sends.
- Updated dependencies [5bc391a]
- Updated dependencies [4a16dd2]
- Updated dependencies [a558001]
- Updated dependencies [87a83d7]
- Updated dependencies [882d5a5]
- Updated dependencies [b95191f]
- Updated dependencies [ada8084]
- Updated dependencies [29f008d]
  - @rxova/journey-core@1.0.0-rc.2

## 1.0.0-rc.1

### Major Changes

- 1cdde02: ## Breaking changes

  ### `createJourney()` replaces `createJourneyBindings()`

  The previous context-based bindings factory, root-level `JourneyProvider`, `JourneyRenderer`, and
  provider-free hook exports have been removed in favor of the new machine-first runtime API.

  ### Provider-owned journeys start in layout phase

  `JourneyProvider` now calls `machine.startJourney()` in a layout effect so the journey is running before
  first paint.

  ### Re-exported runtime constants removed

  `JOURNEY_STATUS`, `JOURNEY_EVENT`, `JOURNEY_ASYNC_PHASE`, and `JOURNEY_WILDCARD` are no longer
  re-exported from `@rxova/journey-react`.

  ### `JourneyApi` return types changed

  `clearStepError`, `updateContext`, and `updateStepMetadata` now return `JourneySnapshot` instead
  of `void`.

  ### Aligned with the new core transition, status, and type model

  React journey definitions now use the declarative graph or linear syntax, the simplified
  4-parameter `JourneyDefinition`, and the new past-tense status / event names.

  ## Added

  ### `useJourneyComputed()`

  Exposes `machine.getComputed()` as a hook with snapshot-driven re-rendering.

  ### `useJourneySelector(selector, equalityFn?)`

  Subscribes to a derived slice of the snapshot with optional custom equality.

  ### `useJourneyApi().goToStepById(stepId)`

  Adds the convenience navigation API that maps to the core `goToStepById` event.

  ### `useJourneyStepLifecycle(stepId, { onEnter?, onLeave? })`

  Runs side effects when a specific step is entered or left while always calling the latest
  callbacks.

  ### `@rxova/journey-react/client`

  Adds an explicit client-marked subpath for Next.js App Router boundaries while keeping the root
  entry server-safe.

  ## Changed
  - `JourneyProvider` disposal is now opt-in via `disposeOnUnmount`
  - `JourneyProvider` reports provider-owned startup failures through `onError(error, { phase: "startJourney" })`
  - `updateContextQueued()` has been removed; use `updateContext()` from `useJourneyApi()` instead
  - React stays aligned with the core timeout support and runtime refactors

### Patch Changes

- Updated dependencies [1cdde02]
  - @rxova/journey-core@1.0.0-rc.1

## Unreleased

### Patch Changes

- `StepRenderer` and `JourneyProvider` status tracking now subscribe through selectors so unrelated snapshot updates no longer rerender those paths.
- `useJourneyApi()` now includes `startJourney()` to match the core machine control surface.
- React tests now cover inline selector usage, `startTransition` read consistency, and hook behavior after runtime disposal.

## 0.7.0

### Minor Changes

- 239f7c5: ## What changed
  - `useJourneyApi()` now returns real `JourneySendResult`s from `send`, `goToNextStep`, `completeJourney`, `terminateJourney`, and the other navigation helpers instead of only returning `Promise<void>`.
  - That aligns React with the new core error model: fire-and-forget calls like `void api.goToNextStep()` no longer surface unhandled promise rejections when guards or effects fail, because failures now come back on `result.error`.
  - A new `useJourneySelector(selector, equalityFn?)` hook was added on top of the new core selector subscription primitive, letting components subscribe to a derived slice and skip rerenders when unrelated snapshot fields change.
  - A new `useJourneyEvent(listener)` hook was added so bindings users can consume typed lifecycle telemetry without manually wiring `machine.subscribeEvent(...)`.
  - Provider lifecycle handling is now explicit. `JourneyProvider` still auto-starts an `idled` machine, but disposal is opt-in through `disposeOnUnmount`, so shared runtimes survive provider unmounts by default.
  - Provider no longer resets its internal machine just because the `persistence` prop identity changes. For apps that depended on the old behavior, `resetOnPersistenceChange` was added as the explicit opt-in path.
  - Provider also now accepts `requireExplicitCompletion`, plus `onStart`, `onComplete`, and `onTerminate` callbacks that wrap the new core lifecycle subscriptions for both internal and external machines.
  - `useJourneySnapshot()` now binds `subscribe` and `getSnapshot` before handing them to `useSyncExternalStore`, fixing compatibility with external machine wrappers whose methods rely on `this`.
  - `StepRenderer` now remounts by `currentStepId`, which matters when different steps intentionally share the same React component but should not share local component state.
  - The old `updateComponentMetadata` alias was removed from both the exported API type and the runtime object returned by `useJourneyApi()`. `updateStepMetadata` is now the single supported name.
  - React docs, examples, and tests were refreshed around selector subscriptions, event subscriptions, provider edge cases, StrictMode stability, and the updated result-returning API shape.

  ## Breaking changes
  - `updateComponentMetadata` was removed from `JourneyApi` and from the `useJourneyApi()` runtime object. Consumers must call `updateStepMetadata` instead.
  - Provider no longer resets its internal machine just because the `persistence` prop identity changed. If your app relied on that implicit reset, you now need `resetOnPersistenceChange`.

### Patch Changes

- Updated dependencies [239f7c5]
  - @rxova/journey-core@0.7.0

## 0.6.4

### Patch Changes

- 4ee201f: Per-package patch notes:
  - `@rxova/journey-devtools-bridge`
    - Guarded bridge transport posting with a safe `try/catch` so `window.postMessage` failures are swallowed.
    - Prevents bridge lifecycle/command flows from throwing when browser messaging is unavailable or rejects.
  - `@rxova/journey-react`
    - Memoized provider context value in `Provider` to keep stable references when `machine`/`journey` inputs are unchanged.
    - Reduces unnecessary rerenders for memoized consumers during unrelated parent rerenders and StrictMode churn.
  - `@rxova/journey-core`
    - Added listener-churn edge coverage to verify snapshot/event subscriptions are fully removed after unsubscribe.
    - Hardens regression protection around subscription retention behavior.

- Updated dependencies [4ee201f]
  - @rxova/journey-core@0.6.4

## 0.6.3

### Patch Changes

- 99a6635: Added a new public API TSDoc quality gate (docs:api:check) that verifies callable exports from package entrypoints have TSDoc summaries.
  - Enforced that check in CI/docs workflows and documented it in contributor/docs guides.
  - Added the checker implementation and comprehensive tests for pass/fail/CLI behavior.
  - Added/updated TSDoc on key public exports:
    - core transition builders (tx, createTransitions)
    - react bindings factory (createJourneyBindings)
    - devtools bridge attach + protocol envelope/command validators
  - No runtime behavior changes; this branch is primarily API documentation quality/tooling hardening.

  @rxova/journey-core
  - Added TSDoc summaries for public transition helpers (tx, createTransitions).
  - Added tests for the new API TSDoc checker (check-public-api-tsdoc) under core tests.
  - No runtime behavior changes.

  @rxova/journey-react
  - Added a TSDoc summary for createJourneyBindings (public React API entrypoint helper).
  - No runtime behavior changes.

  @rxova/journey-devtools-bridge
  - Added TSDoc summaries for public bridge/protocol APIs (attachJourneyDevtools and envelope/command validators).
  - No runtime behavior changes.

  apps-docs
  - Documented the new API docs quality gate (pnpm run docs:api:check) in the docs README.
  - No end-user docs content changes beyond contributor/developer guidance.

  repo/tooling (cross-package)
  - Added docs:api:check script to root package.json.
  - Added scripts/check-public-api-tsdoc.ts to enforce TSDoc coverage on public callable exports.
  - Wired this check into CI/docs workflows and contributing guidelines.

- Updated dependencies [99a6635]
  - @rxova/journey-core@0.6.3

## 0.6.2

### Patch Changes

- 6a38c50: - Tightened core machine typing by introducing JourneySendEvent and removing unsafe as unknown/as never casts in convenience APIs.
  - Replaced JourneyStepDefinition’s open Record<string, unknown> escape hatch with explicit typed step extensions.
  - Added runtime validation in devtools bridge for command stepId values (goToStepById, updateStepMetadata, clearStepError), returning commandError for unknown steps.
  - Added/updated tests for type coverage and bridge invalid-step behavior.
  - Added JSDoc to key public core types (including transition/event builder generics) and improved type readability with
    JourneyGoToStepByIdEventType.
- Updated dependencies [6a38c50]
  - @rxova/journey-core@0.6.2

## 0.6.1

### Patch Changes

- 7be5e0c: minor updates
  - adds shell header + set -e to Husky hooks,
  - fixes test fixture newline escaping,
  - adds explanatory comment before "use client",
  - tiny docs visual tweak.

- Updated dependencies [7be5e0c]
  - @rxova/journey-core@0.6.1

## 0.6.0

### Minor Changes

- 56234c2: Improve docs across Core, React, and Devtool Bridge, including API restructuring, clearer runtime semantics references, and TypeScript-focused guidance.

### Patch Changes

- Updated dependencies [56234c2]
  - @rxova/journey-core@0.6.0

## 0.5.0

### Minor Changes

- 16db5e3: Journey 0.5.0 is a full platform-level upgrade across core runtime, React bindings, and devtools.
  This 0.5.0 release focuses on deterministic flow behavior, stronger typing, cleaner APIs, and
  better observability/debuggability.

  ## `@rxova/journey-core`

  ### New and improved
  - New canonical snapshot shape with `history.timeline` + `history.index` pointer model.
  - Deterministic pointer navigation APIs: `goToPreviousStep(steps?)`, `goToLastVisitedStep()`.
  - Convenience helpers: `goToNextStep()`, `completeJourney(payload?)`, `terminateJourney(payload?)`.
  - Built-in fallback semantics for `back`/`goToPreviousStep` event sends when no explicit transition matches.
  - Strongly typed transition builder ergonomics via `createTransitions` and `tx` helpers (`toComplete`, `toTerminate`, branching builders).
  - First-match-wins transition execution preserved and clarified for reliability.
  - Typed async transition phases exposed in snapshot: `idle`, `evaluating-when`, `error`.
  - Metadata is now first-class at runtime via `snapshot.stepMeta` and `updateStepMetadata(stepId, updater)`.
  - Typed observability stream via `subscribeEvent(...)` with lifecycle/navigation/metadata events.
  - Expanded persistence model with versioning/migration support and safer hydration of invalid data.

  ### Breaking changes
  - v1 top-level `timeline` / `index` snapshot fields removed.
  - `HISTORY_TARGET` removed.
  - Legacy history helpers removed (`trimHistory`, `clearHistory`, overflow options).
  - Persistence now targets v2 snapshot structure and should be migrated with `migrate(...)` when needed.

  ## `@rxova/journey-react`

  ### New and improved
  - Bindings-first architecture is now the default.
  - `createJourneyBindings(journey)` returns typed `Provider`, `StepRenderer`, `useJourneyApi`, `useJourneySnapshot`, and `useJourneyMachine`.
  - Journey typing is captured once at bindings creation time; hook callsites no longer need per-call generics.
  - `useJourneyApi()` now delegates to machine-level navigation helpers (`goToNextStep`, `completeJourney`, `terminateJourney`, pointer APIs).
  - Imperative jumps remain available using event send: `api.send({ type: "goToStepById", stepId })` and `api.send({ type: "goToStepById", stepId, payload })`.
  - `resetOnJourneyChange` behavior is explicitly supported for intentional machine resets when journey definition identity changes.

  ### Breaking changes
  - Legacy global React hooks/components API removed in favor of bindings-first usage.
  - `goToStepById(...)` is no longer a dedicated `useJourneyApi` helper; use `api.send({ type: "goToStepById", ... })`.
  - Existing apps that called old global hooks/components or helper methods must migrate to bindings APIs.

  ## `@rxova/journey-devtools-bridge`

  ### New and improved
  - Protocol remains version `3` (no protocol version bump in this release).
  - Richer command set for runtime control: `goToNextStep`, `terminateJourney`, `completeJourney`, `goToStepById`, `goToPreviousStep`, `goToLastVisitedStep`, `updateStepMetadata`, `send`, `resetJourney`, `clearStepError`.
  - Snapshot payloads now include full v2 runtime state: `currentStepId`, `history.timeline`, `history.index`, `context`, `visited`, `stepMeta`, `status`, `async`.
  - Safer runtime defaults: bridge enabled by default in non-production; disabled by default in production unless explicitly enabled; commands disabled by default in production unless explicitly enabled.

  ### Breaking changes
  - Consumers should align command/snapshot assumptions with current protocol v3 shape.
  - Tooling relying on old snapshot/history shape must migrate to `history.timeline` and `history.index`.

  ## Migration checklist
  - Update core snapshot reads from v1 fields to v2 fields (`snapshot.timeline` -> `snapshot.history.timeline`, `snapshot.index` -> `snapshot.history.index`).
  - Replace removed history APIs (`trimHistory`, `clearHistory`, overflow options) with pointer navigation APIs.
  - Migrate persisted snapshots to v2 shape (or provide `persistence.migrate`).
  - Move React usage to bindings-first patterns (`createJourneyBindings` + bound hooks/components).
  - Replace `api.goToStepById(...)` calls with `api.send({ type: "goToStepById", ... })`.
  - Update devtools integrations to current protocol v3 command/snapshot structures.

  ## Notes
  - This release is intentionally comprehensive and includes updated docs, examples, devtools integration notes, and test coverage for the new model.
  - Package versions are set to `minor` so the fixed published package group bumps from `0.4.0` to `0.5.0`.
  - App package versions are also aligned to `0.5.0` for `apps-docs` and `apps-devtools`.

### Patch Changes

- Updated dependencies [16db5e3]
  - @rxova/journey-core@0.5.0

## 0.4.0

### Minor Changes

- 176007f: - Added full Chrome DevTools extension app
  - Added new bridge package with protocol + bridge runtime.
  - Added/expanded demo integration to exercise DevTools + bridge flows.
  - Added Devtool documentation section.
  - Updated docs UX in index.tsx, sidebars.ts, and search styling in styles.module.css.
  - Added CI/CD workflows for docs/devtools and Chrome Web Store publishing in devtools.yml, devtools-publish.yml, docs.yml.
  - Updated release/versioning config in config.json and scripts in package.json (pnpm run releases).
  - Updated README files across packages.

### Patch Changes

- @rxova/journey-core@0.4.0

## 0.3.0

### Minor Changes

- a3a8ea0: fix: keep visited independent of history trimming and persist it across hydrates

### Patch Changes

- Updated dependencies [a3a8ea0]
  - @rxova/journey-core@0.3.0

## 0.2.0

### Minor Changes

- 9cb812c: # Add history management and trimming controls
  - Core: `history` options with `maxHistory`, `onOverflow`, and manual `trimHistory`/`clearHistory`.
  - React: pass `history` options through `<JourneyProvider>` and expose trim/clear in `useJourney` API.
  - Docs: clarify history/visited behavior and overflow reasons.

### Patch Changes

- Updated dependencies [9cb812c]
  - @rxova/journey-core@0.2.0
