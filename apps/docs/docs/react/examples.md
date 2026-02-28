---
id: examples
title: React Examples
sidebar_label: Examples
---

Common example patterns:

| Pattern               | What it demonstrates                                                                               |
| --------------------- | -------------------------------------------------------------------------------------------------- |
| Basic bindings setup  | `createJourneyBindings` + `Provider` + `StepRenderer`                                              |
| Controlled navigation | `goToNextStep`, `goToPreviousStep`, `send({ type: "goToStepById", ... })`, pointer navigation APIs |
| Metadata updates      | `updateStepMetadata`                                                                               |
| Async UI              | `snapshot.async`-driven loading/error states                                                       |
| External machine      | Passing `machine` to `Provider`                                                                    |
| Journey switching     | `resetOnJourneyChange` behavior                                                                    |

See `apps/demo` for a complete core + react + devtools integration.
