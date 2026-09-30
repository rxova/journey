---
"@rxova/journey-react": patch
---

Internal: the development-warning helper now lives in the package's own source instead of an unpublished workspace package, and the inlined @rxova/ts-utils is 0.2. Its React entry makes the ESM build's import from react name a few more hooks, all present since React 18 and none called; no public API, behaviour or dependency change.
