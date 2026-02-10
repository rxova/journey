# Examples Catalog

## Minimal

- `simple-journey.tsx`: absolute minimum linear `next -> next -> submit`.
- `simple-back.journey.tsx`: minimal back navigation with `HISTORY_TARGET`.
- `go-to-jump.journey.tsx`: imperative `goTo` jump.

## Specific Features

- `conditional-skip.journey.tsx`: optional step based on context.
- `first-match-wins.journey.tsx`: transition ordering behavior.
- `custom-event.journey.tsx`: custom event via `api.send({ type })`.
- `async-guard.journey.tsx`: async validation in `when`.
- `async-effect.journey.tsx`: async context update in `effect`.
- `dynamic-steps.journey.tsx`: add/remove optional step by rebuilding journey graph at runtime.
- `confirm-close.journey.tsx`: dirty-close confirmation journey.
- `history-back.journey.tsx`: branch-aware back behavior.

## Real Journeys

- `group-trip.journey.tsx`
- `itinerary-builder.journey.tsx`
- `onboarding.journey.tsx`
- `checkout.journey.tsx`
- `support-ticket.journey.tsx`
