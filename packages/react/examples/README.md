# Examples Catalog

These React examples are `createJourney()` wrappers around the canonical flow definitions in
`packages/core/examples`.

## Minimal

- `simple-flow.tsx`: absolute minimum linear `goToNextStep -> goToNextStep -> completeJourney`.
- `simple-back.flow.tsx`: minimal pointer-based back navigation (`api.goToPreviousStep()`).
- `go-to-jump.flow.tsx`: direct jump with the built-in `goToStepById` event.

## Specific Features

- `conditional-skip.flow.tsx`: optional step based on context.
- `first-match-wins.flow.tsx`: transition ordering behavior.
- `custom-event.flow.tsx`: custom event via `api.send({ type })`.
- `subscribe-vs-subscribe-event.flow.tsx`: snapshot updates via `useJourneySnapshot` and typed telemetry via `useJourneyEvent`.
- `async-guard.flow.tsx`: async validation in `when`.
- `async-transition-update.flow.tsx`: async data preparation before a transition `updateContext`.
- `dynamic-steps.flow.tsx`: add/remove optional step by rebuilding journey graph at runtime.
- `reset-on-journey-change.flow.tsx`: intentionally swap to a new journey instance when the definition variant changes.
- `confirm-close.flow.tsx`: dirty-close confirmation journey.
- `history-back.flow.tsx`: branch-aware back behavior.

## Real Journeys

- `group-trip.flow.tsx`
- `itinerary-builder.flow.tsx`
- `onboarding.flow.tsx`
- `checkout.flow.tsx`
- `support-ticket.flow.tsx`
