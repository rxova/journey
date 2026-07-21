---
"@rxova/journey-react": minor
"@rxova/journey-core": patch
---

React review cleanups. The React `LinearJourneySnapshot` narrows `currentStep` to non-null (a rendered linear journey is never idle). `useJourneySelector` now keeps a single machine subscription across re-renders with inline selectors. Core (patch): `registerNextStepInterceptor` warns in development when overwriting a live registration for the same step.
