---
"@rxova/journey-devtools-bridge": patch
---

Bundle the graph builder's type parameters into a single `JourneyTypes` object.
`createGraphJourneyBuilder<Ctx, Step, Ev>()` becomes
`createGraphJourneyBuilder<{ context: Ctx; stepId: Step; events: Ev }>()` —
named fields instead of positional generics, with omitted fields defaulting via
`ResolveJourneyTypes`. The factory functions (`createGraphJourney`,
`createLinearJourney`, …) keep positional generics, since they infer types from
the definition value.

Also replaces the `Record<never, never>` "no events / no handlers" default with
the named `JourneyEmpty` alias throughout, so generated type signatures and docs
read cleanly instead of surfacing `never`.
