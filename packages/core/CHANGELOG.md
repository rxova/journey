# @rxova/journey-core

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
  - Typed async transition phases exposed in snapshot: `idle`, `evaluating-when`, `running-effect`, `error`.
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
  - Richer command set for runtime control: `goToNextStep`, `terminateMachine`, `completeJourney`, `goToStepById`, `goToPreviousStep`, `goToLastVisitedStep`, `updateStepMetadata`, `send`, `resetMachine`, `clearStepError`.
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
