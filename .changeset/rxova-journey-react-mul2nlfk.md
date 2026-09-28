---
"@rxova/journey-react": patch
---

Internal: the layout-effect hook now comes from @rxova/ts-utils/react, inlined at build time. It picks useEffect when there is no document (previously: no window), so a runtime that defines window without document no longer gets useLayoutEffect on the server. No public API or dependency change.
