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
- `dynamic-steps.flow.tsx`: add/remove optional step by rebuilding journey graph at runtime.
- `reset-on-journey-change.flow.tsx`: intentionally recreate the internal machine when the `journey` reference changes.
- `confirm-close.flow.tsx`: dirty-close confirmation journey.
- `history-back.flow.tsx`: branch-aware back behavior.

## Real Journeys

- `move-users.flow.tsx`
- `order-cards.flow.tsx`
- `onboarding.flow.tsx`
- `checkout.flow.tsx`
- `support-ticket.flow.tsx`
