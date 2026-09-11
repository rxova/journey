---
"@rxova/journey-react": minor
"@rxova/journey-core": patch
---

React review cleanups. Bundle `useSelector` hooks keep a single machine subscription across re-renders with inline selectors (the getter-side cache returns stable references). Core (patch): `registerNextStepInterceptor` warns in development when overwriting a live registration for the same step.
