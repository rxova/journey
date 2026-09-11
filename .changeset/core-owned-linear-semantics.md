---
"@rxova/journey-core": minor
---

Core owns all linear-tier semantics (RFC 0001 §3.12): new creation options `startAt` (start directly at a step — earlier steps are neither entered nor visited; unknown ids throw) and `persist` (`{ key, storage? }`, expanding to the persistence plugin with a guarded `localStorage` default); the `stepEnter` event payload now carries an intent-based `direction` (`"forward" | "backward" | "jump"`); `machine.navigate.registerNextStepInterceptor(stepId, work)` registers per-step forward-navigation work consulted by `goToNextStep`; linear machines gain `machine.navigate.goToStepByIndex(index)`.
