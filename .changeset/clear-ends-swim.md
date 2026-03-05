---
"@rxova/journey-devtools-bridge": patch
"@rxova/journey-react": patch
"@rxova/journey-core": patch
---

- Tightened core machine typing by introducing JourneySendEvent and removing unsafe as unknown/as never casts in convenience APIs.
- Replaced JourneyStepDefinition’s open Record<string, unknown> escape hatch with explicit typed step extensions.
- Added runtime validation in devtools bridge for command stepId values (goToStepById, updateStepMetadata, clearStepError), returning commandError for unknown steps.
- Added/updated tests for type coverage and bridge invalid-step behavior.
- Added JSDoc to key public core types (including transition/event builder generics) and improved type readability with
  JourneyGoToStepByIdEventType.
