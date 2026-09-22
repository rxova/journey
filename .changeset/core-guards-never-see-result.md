---
"@rxova/journey-core": patch
---

A work send no longer hands the run `result` to its candidates' guards. The type has not declared it
since guards became total functions of context, but the runtime still passed it, so an untyped guard
that read it routed one way during the send and another during snapshot derivation, where there is
no result. Guards now receive exactly `{ context, handlers }` everywhere; a routing fact goes through
`commit` into the staged context.

The `defineWork` example and the docs that still described result-reading guards are corrected.
