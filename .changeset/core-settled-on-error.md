---
"@rxova/journey-core": minor
---

Machines gain `settled()` and the `onError` creation option. `settled()` resolves with the run's
outcome once the machine completes or terminates, at once if it already has, and rejects with a
`JourneyError` coded `disposed` if the machine is disposed first — so a test or a server-side flow
awaits an outcome instead of polling snapshots. `onError: "terminate"` makes every failure reported
through the `error` event end the run, with `{ error, phase, stepId }` (the new exported
`JourneyFailure` type) as the terminated outcome's payload; the default, `"stay"`, keeps today's
behaviour. `JourneyErrorPhase` names the `error` event's phase union.
