---
"@rxova/journey-devtools-bridge": patch
"@rxova/journey-react": patch
"@rxova/journey-core": patch
"apps-docs": patch
---

Added a new public API TSDoc quality gate (docs:api:check) that verifies callable exports from package entrypoints have TSDoc summaries.

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
