---
"@rxova/journey-core": patch
---

`registerNextStepInterceptor` now keeps a per-step registration stack instead of a single slot.
Resolution is unchanged — the most recent registration still wins — but unregistering it now
reinstates the registration it shadowed, rather than leaving the step ungated. Previously, when
two owners guarded the same step and the newer one unregistered, `goToNextStep` silently stopped
being intercepted even though the older owner was still live; the only signal was a
development-only warning. The returned disposer still removes only its own registration, so a
stale disposer cannot disturb the active one.
