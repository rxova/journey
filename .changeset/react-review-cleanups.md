---
"@rxova/journey-react": minor
---

React review cleanups. Bundle `useSelector` hooks keep a single machine subscription across re-renders with inline selectors (the getter-side cache returns stable references).
