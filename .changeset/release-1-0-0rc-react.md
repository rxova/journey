---
"@rxova/journey-react": major
---

## Breaking changes

### `createJourney()` replaces `createJourneyBindings()`

The previous context-based bindings factory, root-level `JourneyProvider`, `JourneyRenderer`, and
provider-free hook exports have been removed in favor of the new machine-first runtime API.

### Provider-owned journeys start in layout phase

`JourneyProvider` now calls `machine.start()` in a layout effect so the journey is running before
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
- `JourneyProvider` reports provider-owned startup failures through `onError(error, { phase: "start" })`
- `updateContextQueued()` has been removed; use `updateContext()` from `useJourneyApi()` instead
- React stays aligned with the core timeout support and runtime refactors
