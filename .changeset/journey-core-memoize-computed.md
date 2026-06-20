---
"@rxova/journey-core": patch
---

Memoize `getComputed()` by snapshot identity. Repeated calls between state commits now return the same frozen result object, giving framework adapters (React `useSyncExternalStore`, Vue `computed`, Angular signals) referential stability for free. The returned computed object is now frozen, since it is shared across callers.
