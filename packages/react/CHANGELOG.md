# @rxova/journey-react

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
