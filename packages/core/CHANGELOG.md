# @rxova/journey-core

## 1.0.0-rc.3

### Patch Changes

- [#131](https://github.com/rxova/journey/pull/131) [`5a7c344`](https://github.com/rxova/journey/commit/5a7c344d219cc24b4c2b3bf7ee3c1039a129045e) - Broaden the npm keywords

  Registry metadata is read far more often than it is written, and it was missing
  the words people search for. Adds `multi-step-form`, `multi-step`, `onboarding`
  and `checkout-flow` — what the problem is called by somebody who has it and does
  not yet know this exists — plus the parts of the model that are the reason to
  choose this over an array and a pointer: `branching`, `guards`, `transitions`,
  `history`, `time-travel`. `framework-agnostic`, `vanilla-js` and
  `zero-dependency` say what makes it usable outside React at all. No code changes
  — a patch release is only how the new metadata reaches npm.

## 1.0.0-rc.2

### Patch Changes

- 5bc391a: Add `journey.reset` / `subscribeReset`, and simplify examples and docs around machine-wide lifecycle observation.
- 4a16dd2: Rename the machine startup API from `start()` to `startJourney()`.
- a558001: Improve graph builder transition typing.
- 87a83d7: Make transition callback context readonly.
- 882d5a5: Expose builder event metadata for step-scoped sends.
- b95191f: Run terminal transition lifecycle callbacks before completing or terminating.
- ada8084: Treat global transitions as fallbacks after step-local transitions.
- 29f008d: Replace user-authored transition ids with internal ids and labels.

## 1.0.0-rc.1

### Major Changes

- 1cdde02: ## Breaking changes

  ### `JourneyDefinition` simplified from 6 to 4 generic parameters

  The separate event-type and payload-map generics are now represented by a single `TEventMap`
  record, and the extra step generic has been removed.

  ### Declarative transitions replace the old builder exports

  `tx()`, `createTransitions()`, and `createTypedTransitionHelpers()` are gone from the public API.
  Transitions now use declarative graph syntax or linear syntax.

  ### Explicit machine lifecycle with `machine.startJourney()`

  Machines are created in the `"idled"` state and must be started explicitly. `resetJourney()`
  returns the machine to `"idled"`.

  ### Renamed public API surface
  - `createMachine()` -> `createJourneyMachine()`
  - `resetMachine()` -> `resetJourney()`
  - `Machine` -> `JourneyMachine`

  ### Core features extracted into plugins

  Persistence and execution-path enumeration are no longer built into the base machine. Register
  plugins explicitly instead.

  ### Exported runtime constants removed

  `JOURNEY_STATUS`, `JOURNEY_EVENT`, `JOURNEY_ASYNC_PHASE`, and `JOURNEY_WILDCARD` are no longer
  exported. Use the corresponding string literal types instead.

  ### Status and observation event names aligned to past tense

  Status values now use names such as `"completed"` and `"terminated"`.

  ## Added

  ### `createJourneyBuilder`

  A per-step graph builder API that compiles to the same `JourneyDefinition` accepted by
  `createJourneyMachine()` and `createJourney()`.

  ### First-party plugins
  - Analytics
  - Autosave
  - Diagnostics
  - Execution paths
  - Persistence
  - Replay

  ### `goToStepById` is now mode-aware

  In headless mode it performs caller-driven navigation. In graph or linear mode it follows declared
  transitions like any other event.

  ### `onEnter` / `onLeave` lifecycle callbacks

  Step definitions can now declare observational enter/leave callbacks.

  ### `timeoutMs` on transitions

  Async guards and effects can now time out independently, fail cleanly, and emit the normal
  transition failure path.

  ## Changed
  - `updateContextQueued()` has been removed; use `updateContext()` instead
  - Internal machine logic was split into smaller runtime, navigation, async-state, control, and send modules

## 0.7.0

### Minor Changes

- 239f7c5: ## What changed
  - Async lifecycle handling is much safer. Resetting or disposing a machine now cancels stale guards and effects, so older async work cannot commit after the machine has already moved on.
  - `send()` and the convenience helpers no longer reject when a guard or effect fails. They resolve with `transitioned: false`, the current `snapshot`, and an `error` field, while still emitting `transition.error` and leaving the source step in async `error`.
  - `goToStepById` is now mode-aware and lifecycle-aware. In graph and linear definitions it follows only declared `goToStepById` transitions, including guards and effects. In headless definitions, omitting `transitions` restores caller-driven direct navigation.
  - Observability is broader and easier to use. The core machine now exposes `subscribeSelector`, exported `JourneySelector` / `JourneyEqualityFn`, and focused lifecycle helpers `subscribeStart`, `subscribeComplete`, and `subscribeTerminate`.
  - A new `journey.start` lifecycle event is emitted on startup, and focused helpers (`subscribeStart`, `subscribeComplete`, `subscribeTerminate`) make lifecycle observation easier without broad event filtering.
  - Persistence was hardened for hostile browser environments. If default storage access throws, machine creation no longer fails, and hydrated machines now preserve `visited` state inferred from timeline history instead of losing it during restore.
  - The reserved wildcard step id `*` is now rejected as a real step name, preventing ambiguous behavior between step identifiers and wildcard transition matching.
  - Transition typing was improved substantially. Builders now support fluent `.when(...).to(...)` and `.otherwise().to(...)` branches, payload inference is sharper, and terminal/helper transitions are typed more precisely.
  - The existing "auto-complete when there is no next-step transition" behavior is now configurable through `requireExplicitCompletion`, rather than being effectively fixed at the runtime level.
  - Docs and tests were expanded around async timing, terminal helpers, persistence hydration, selector subscriptions, and the caveat that `updateContext()` is immediate on the current snapshot but does not retroactively rebase an already-running async transition.

  ## Breaking changes
  - `goToStepById` is no longer one unconditional behavior across every mode. Omitted-transition definitions stay caller-driven, while graph and linear definitions require declared `goToStepById` transitions.
  - TypeScript transition definitions are stricter. Consumers with loosely typed transition builders or payload assumptions may need source updates.

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

## 0.6.2

### Patch Changes

- 6a38c50: - Tightened core machine typing by introducing JourneySendEvent and removing unsafe as unknown/as never casts in convenience APIs.
  - Replaced JourneyStepDefinition’s open Record<string, unknown> escape hatch with explicit typed step extensions.
  - Added runtime validation in devtools bridge for command stepId values (goToStepById, updateStepMetadata, clearStepError), returning commandError for unknown steps.
  - Added/updated tests for type coverage and bridge invalid-step behavior.
  - Added JSDoc to key public core types (including transition/event builder generics) and improved type readability with
    JourneyGoToStepByIdEventType.

## 0.6.1

### Patch Changes

- 7be5e0c: minor updates
  - adds shell header + set -e to Husky hooks,
  - fixes test fixture newline escaping,
  - adds explanatory comment before "use client",
  - tiny docs visual tweak.

## 0.6.0

### Minor Changes

- 56234c2: Improve docs across Core, React, and Devtool Bridge, including API restructuring, clearer runtime semantics references, and TypeScript-focused guidance.

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

## 0.4.0

## 0.3.0

### Minor Changes

- a3a8ea0: fix: keep visited independent of history trimming and persist it across hydrates

## 0.2.0

### Minor Changes

- 9cb812c: # Add history management and trimming controls
  - Core: `history` options with `maxHistory`, `onOverflow`, and manual `trimHistory`/`clearHistory`.
  - React: pass `history` options through `<JourneyProvider>` and expose trim/clear in `useJourney` API.
  - Docs: clarify history/visited behavior and overflow reasons.
