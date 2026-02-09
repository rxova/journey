# Examples Catalog

## Minimal

- `simple-flow.tsx`: absolute minimum linear `next -> next -> submit`.
- `simple-back.flow.tsx`: minimal back navigation with `HISTORY_TARGET`.
- `go-to-jump.flow.tsx`: imperative `goTo` jump.

## Specific Features

- `conditional-skip.flow.tsx`: optional step based on context.
- `first-match-wins.flow.tsx`: transition ordering behavior.
- `custom-event.flow.tsx`: custom event via `api.send({ type })`.
- `async-guard.flow.tsx`: async validation in `when`.
- `async-effect.flow.tsx`: async context update in `effect`.
- `confirm-close.flow.tsx`: dirty-close confirmation flow.
- `history-back.flow.tsx`: branch-aware back behavior.

## Real Journeys

- `group-trip.flow.tsx`
- `itinerary-builder.flow.tsx`
- `onboarding.flow.tsx`
- `checkout.flow.tsx`
- `support-ticket.flow.tsx`
