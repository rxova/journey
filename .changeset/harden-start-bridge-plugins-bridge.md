---
"@rxova/journey-devtools-bridge": patch
---

Harden three runtime/tooling edge cases surfaced by an adoption review.

- **`startJourney()` no longer duplicates initial-step side effects.** The initial step's `effect`
  and `after` timers now run only when the call actually performs the `idled → running` transition,
  so a defensive or repeated `startJourney()` can't re-fire initial fetches/holds or schedule
  duplicate timers. (`controls.startJourney()` now reports whether it started; the public
  `machine.startJourney()` signature is unchanged.)
- **The devtools bridge can no longer throw into the host app.** `window.postMessage` is wrapped in a
  `try/catch` again (restoring the previously documented guard), so a throwing/unavailable
  `postMessage` during register/snapshot/operation/detach is swallowed and logged in development
  instead of breaking attach or transitions.
- **A throwing plugin `onSnapshotChange` no longer aborts a commit.** Plugin snapshot observers are
  now isolated like snapshot/event listeners: a synchronous throw is routed to `onListenerError`
  (context `"snapshot"`) and the transition still commits, so third-party observability/persistence
  plugins can't turn into transition blockers.
