---
"@rxova/journey-core": minor
---

## What changed

- Async lifecycle handling is much safer. Resetting or disposing a machine now cancels stale guards and effects, so older async work cannot commit after the machine has already moved on.
- `send()` and the convenience helpers no longer reject when a guard or effect fails. They resolve with `transitioned: false`, the current `snapshot`, and an `error` field, while still emitting `transition.error` and leaving the source step in async `error`.
- `goToStepById` is now lifecycle-aware. If a matching `goToStepById` transition is declared, its guards and effects run first; the old unconditional direct jump remains only as a fallback when no matching transition exists.
- Observability is broader and easier to use. The core machine now exposes `subscribeSelector`, exported `JourneySelector` / `JourneyEqualityFn`, and focused lifecycle helpers `subscribeStart`, `subscribeComplete`, and `subscribeTerminate`.
- A new `journey.start` lifecycle event is emitted and replayed immediately to each `subscribeEvent` subscriber. That makes startup observable even when logging or analytics subscriptions are attached after machine creation.
- Persistence was hardened for hostile browser environments. If default storage access throws, machine creation no longer fails, and hydrated machines now preserve `visited` state inferred from timeline history instead of losing it during restore.
- The reserved wildcard step id `*` is now rejected as a real step name, preventing ambiguous behavior between step identifiers and wildcard transition matching.
- Transition typing was improved substantially. Builders now support fluent `.when(...).to(...)` and `.otherwise().to(...)` branches, payload inference is sharper, and terminal/helper transitions are typed more precisely.
- The existing "auto-complete when there is no next-step transition" behavior is now configurable through `completeOnNoNextStep`, rather than being effectively fixed at the runtime level.
- Docs and tests were expanded around async timing, terminal helpers, persistence hydration, selector subscriptions, and the caveat that `updateContext()` is immediate on the current snapshot but does not retroactively rebase an already-running async transition.

## Breaking changes

- `goToStepById` no longer always behaves like an unconditional direct jump. If you declare matching `goToStepById` transitions, their guards and effects now run first.
- TypeScript transition definitions are stricter. Consumers with loosely typed transition builders or payload assumptions may need source updates.
