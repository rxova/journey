---
"@rxova/journey-devtools-bridge": minor
---

## Types alignment

Align `@rxova/journey-react` with the `@rxova/journey-core` removal of exported Journey runtime constants.

This package no longer re-exports:

- `JOURNEY_STATUS`
- `JOURNEY_EVENT`
- `JOURNEY_ASYNC_PHASE`
- `JOURNEY_WILDCARD`

If your React app imported those from `@rxova/journey-react`, switch to the corresponding literal values or core type
exports.

See the `@rxova/journey-core` release notes in this release for the detailed API change.

## Transition timeout alignment

This release also keeps React aligned with the earlier `@rxova/journey-core` transition timeout addition for async
guards and effects (`timeoutMs` on transitions). There are no React-specific APIs for timeout handling beyond consuming
the updated core machine behavior through the existing bindings.
