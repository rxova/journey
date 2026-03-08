---
"@rxova/journey-core": minor
---

# Added transtions timeouts

Added transition-level timeout handling for async guards and effects in @rxova/journey-core.

JourneyTransition config now accepts `timeoutMs?: number`. The runtime applies that timeout independently to async when
evaluation and async effect execution. When either async phase exceeds the configured timeout, the machine rejects that
phase with a JourneyTimeoutError, resolves the send result with transitioned: false, preserves the current step, and emits
the usual transition failure path instead of leaving the machine pending indefinitely.

Timeout failures integrate with existing async state semantics:

- async guards move the source step from evaluating-when to error
- async effects move the source step from running-effect to error
- snapshot.async.isLoading is cleared correctly after timeout
- transition.error is emitted with the timeout error
- effect timeouts preserve the active transition id on the send result and step async state

Validation now rejects non-finite timeoutMs values such as `NaN`, `Infinity`, and `-Infinity`. `undefined`, `0`, and negative values remain effectively unbounded and do not activate timeout behavior.

This also extends the typed transition surface so timeoutMs is available in both object-style transitions and fluent
transition builder config, and adds regression coverage for timed-out guards, timed-out effects, repeated sends after
timeout, and invalid timeout configuration.
