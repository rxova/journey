# Examples Catalog (Core)

Headless examples for `@rxova/journey-core`.

## Minimal

- `simple-flow.flow.ts`: absolute minimum linear `next -> next -> submit`.
- `simple-back.flow.ts`: minimal back navigation with `HISTORY_TARGET`.
- `simple-sequence.flow.ts`: tiny two-step sequence.
- `go-to-jump.flow.ts`: imperative `goTo` jump.

## Specific Features

- `conditional-skip.flow.ts`: optional step based on context.
- `first-match-wins.flow.ts`: transition ordering behavior.
- `custom-event.flow.ts`: custom event via `send({ type })`.
- `async-guard.flow.ts`: async validation in `when`.
- `async-effect.flow.ts`: async context update in `effect`.
- `dynamic-steps.flow.ts`: add/remove optional step by rebuilding journey graph at runtime.
- `reset-on-journey-change.flow.ts`: recreate the internal machine when the journey definition changes.
- `confirm-close.flow.ts`: dirty-close confirmation journey.
- `history-back.flow.ts`: branch-aware back behavior.

## Real Journeys

- `group-trip.flow.ts`
- `itinerary-builder.flow.ts`
- `onboarding.flow.ts`
- `checkout.flow.ts`
- `support-ticket.flow.ts`
