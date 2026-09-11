---
"@rxova/journey-core": patch
---

The snapshot's `context` is now shallow-frozen in development, matching every other snapshot
slice. Mutating a context in place changes nothing the machine can observe — no publish, no
subscriber notification, no re-render — so the bug was silent; it now throws where it happens.

Shallow on purpose: deep-freezing would cost a full walk per update and break Maps, Dates, and
class instances that legitimately live in a context. Production behaviour is unchanged.
