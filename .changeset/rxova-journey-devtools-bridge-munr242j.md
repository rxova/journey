---
"@rxova/journey-devtools-bridge": patch
---

Internal: the environment, origin, predicate and serialization helpers now live in the bridge's own source instead of an unpublished workspace package. The bundled code is the same apart from minifier-chosen names; no public API or dependency change.
