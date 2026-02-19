---
id: examples
title: Core Examples
sidebar_label: Examples
---

Representative examples:

| Flow                  | Highlights                                               |
| --------------------- | -------------------------------------------------------- |
| Linear checkout       | `goToNextStep`, `completeJourney`, terminal completion   |
| Pointer navigation    | `goToPreviousStep(n)`, `goToLastVisitedStep()`           |
| Conditional branching | ordered transitions with `when`                          |
| Exit confirmation     | wildcard `terminateJourney` transitions + context guards |
| Metadata updates      | `updateStepMetadata(stepId, updater)`                    |
| Observability         | `subscribeEvent` telemetry stream                        |
| Builder ergonomics    | `createTransitions` + `tx.from/any/when/otherwise`       |

See package examples under `packages/core/examples` for concrete runnable snippets.
