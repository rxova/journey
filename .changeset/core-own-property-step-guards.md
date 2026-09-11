---
"@rxova/journey-core": patch
---

Step-id validation now tests own properties instead of using `in`, which walks the prototype
chain. `"toString"`, `"constructor"`, `"__proto__"`, `"hasOwnProperty"`, `"valueOf"`,
`"isPrototypeOf"`, `"propertyIsEnumerable"`, and `"toLocaleString"` passed every guard that
compared an id against the steps record, producing a machine parked on a step that does not exist.

The visible failure was a phantom position: `goToStepById("hasOwnProperty")` returned
`{ ok: true }` with `currentStep.index === -1`, so every order-derived snapshot field
(`index`, `isFirstStep`, `isLastStep`) lied, and `goToNextStep()` from there resolved
`indexOf(...) === -1` to index `0` — a "Next" button that silently rewound the journey to step
one. The phantom entry also stayed in the timeline permanently.

Two of the nine affected guards sit on input the application does not author: the persisted-record
predicate behind the creation-time `persist` option, and `goToStepById`, which is routinely fed a
route parameter. A tampered or drifted storage record could therefore restore onto a phantom step
even though `readRestorableState` documents that definition drift is rejected.

`registerNextStepInterceptor` now also throws for these ids, as its documentation always claimed.
Steps legitimately named after a prototype key keep working — they are own properties, so they
were never the problem.
