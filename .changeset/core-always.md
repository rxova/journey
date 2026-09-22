---
"@rxova/journey-core": minor
---

A graph step can advance itself with `always`. It takes the same forms as an `on` entry — a target,
ordered candidates, or `{ run, commit?, candidates }` work — and runs once the step's entry
settles, so a step can route on context or on the answer to a call without the caller sending
anything. The call that entered the step resolves once the chain rests. Hooks and work see
`event: null`; the edge appears as `"$always"` in `outgoingTransitions`, `availableSteps` and
`analyzeStructure`, but not in `declaredEvents` or `availableEvents`. A chain longer than the new
`maxAutoSteps` option (default 100) stops and emits an `error` with phase `"always"`. Declaring
`$always` in `on` throws `JourneyError` code `reserved-event`. `defineAlways<Bag>()` infers an
`always` entry's result type the way `defineWork` does.
