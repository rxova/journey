---
"apps-devtools": minor
---

## What changed

- The panel now has section-level error boundaries around connection status, machine selection, timeline inspection, and commands. A failure in one area now degrades locally with a retry button instead of taking down the whole panel.
- Timeline rendering was virtualized so large machine histories stay responsive. The panel now measures row height and viewport height, applies overscan, and keeps "follow latest" behavior working with the virtualized list.
- Background and content-script cache replay was simplified around the assumption that retained machines already have seeded snapshot state, which makes reconnect and reopen behavior more predictable.
- Panel styling was updated to support the new error-boundary states and the virtualized timeline layout without regressing the existing inspection flow.
- Test coverage expanded significantly across the background worker, content script, panel app, store, command utilities, diff handling, and shared guards, giving much better regression coverage around the extension's message flow.
- The app changelog was also backfilled with missing `0.5.0` and `0.6.0` release details so the DevTools release trail is now complete and aligned with the docs site.

## Breaking changes

- None called out for `apps-devtools`.
