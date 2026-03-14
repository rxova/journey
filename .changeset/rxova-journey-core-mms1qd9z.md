---
"@rxova/journey-core": minor
---

Remove the exported Journey runtime constants from `@rxova/journey-core` and simplify the related public types.

This change removes:

- `JOURNEY_STATUS`
- `JOURNEY_EVENT`
- `JOURNEY_ASYNC_PHASE`
- `JOURNEY_WILDCARD`

Core now exposes the corresponding concepts through plain string literal types and unions instead of runtime constant
objects.

Examples:

- `JourneyStatus` is now `"running" | "complete" | "terminated"`
- `JourneyAsyncPhase` is now `"idle" | "evaluating-when" | "running-effect" | "error"`
- `JourneyGoToStepByIdEventType` is now `"goToStepById"`
- `JourneyBuiltInFrom` is now `"*"`

This is a breaking API cleanup for consumers importing those constants at runtime. Update usages to inline the literal
values or depend on the exported types instead.
