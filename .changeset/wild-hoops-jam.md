---
"@rxova/journey-core": patch
---

Broaden the npm keywords

Registry metadata is read far more often than it is written, and it was missing
the words people search for. Adds `multi-step-form`, `multi-step`, `onboarding`
and `checkout-flow` — what the problem is called by somebody who has it and does
not yet know this exists — plus the parts of the model that are the reason to
choose this over an array and a pointer: `branching`, `guards`, `transitions`,
`history`, `time-travel`. `framework-agnostic`, `vanilla-js` and
`zero-dependency` say what makes it usable outside React at all. No code changes
— a patch release is only how the new metadata reaches npm.
