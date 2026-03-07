---
"@rxova/journey-react": minor
---

## What changed

- `useJourneyApi()` now returns real `JourneySendResult`s from `send`, `goToNextStep`, `completeJourney`, `terminateJourney`, and the other navigation helpers instead of only returning `Promise<void>`.
- That aligns React with the new core error model: fire-and-forget calls like `void api.goToNextStep()` no longer surface unhandled promise rejections when guards or effects fail, because failures now come back on `result.error`.
- A new `useJourneySelector(selector, equalityFn?)` hook was added on top of the new core selector subscription primitive, letting components subscribe to a derived slice and skip rerenders when unrelated snapshot fields change.
- A new `useJourneyEvent(listener)` hook was added so bindings users can consume typed lifecycle telemetry without manually wiring `machine.subscribeEvent(...)`.
- Provider lifecycle handling is much safer. Internally owned machines are now disposed when replaced or unmounted, which prevents stale async work from an older machine instance from committing later.
- Provider no longer resets its internal machine just because the `persistence` prop identity changes. For apps that depended on the old behavior, `resetOnPersistenceChange` was added as the explicit opt-in path.
- Provider also now accepts `completeOnNoNextStep`, plus `onStart`, `onComplete`, and `onTerminate` callbacks that wrap the new core lifecycle subscriptions for both internal and external machines.
- `useJourneySnapshot()` now binds `subscribe` and `getSnapshot` before handing them to `useSyncExternalStore`, fixing compatibility with external machine wrappers whose methods rely on `this`.
- `StepRenderer` now remounts by `currentStepId`, which matters when different steps intentionally share the same React component but should not share local component state.
- The old `updateComponentMetadata` alias was removed from both the exported API type and the runtime object returned by `useJourneyApi()`. `updateStepMetadata` is now the single supported name.
- React docs, examples, and tests were refreshed around selector subscriptions, event subscriptions, provider edge cases, StrictMode stability, and the updated result-returning API shape.

## Breaking changes

- `updateComponentMetadata` was removed from `JourneyApi` and from the `useJourneyApi()` runtime object. Consumers must call `updateStepMetadata` instead.
- Provider no longer resets its internal machine just because the `persistence` prop identity changed. If your app relied on that implicit reset, you now need `resetOnPersistenceChange`.
