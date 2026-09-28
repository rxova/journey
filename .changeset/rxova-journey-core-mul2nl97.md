---
"@rxova/journey-core": patch
---

Internal: the snapshot's shallow equality check now comes from @rxova/ts-utils, inlined at build time. Same own-key Object.is comparison, no public API or dependency change.
