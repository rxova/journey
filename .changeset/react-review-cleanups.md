---
"@rxova/journey-react": minor
"@rxova/journey-core": patch
---

React review cleanups. **Breaking (pre-1.0, react):** the global `React.Attributes` `id` augmentation is removed — `<LinearJourney.Step id>` is the canonical step spelling; inline `id` still works at runtime and type-checks only for components that declare their own `id` prop. The React `LinearJourneySnapshot` narrows `currentStep` to non-null (the linear tier always autostarts). `useJourneySelector` now keeps a single machine subscription across re-renders with inline selectors. Core (patch): `registerNextStepInterceptor` warns in development when overwriting a live registration for the same step.
