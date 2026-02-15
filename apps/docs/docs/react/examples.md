---
title: React Examples
sidebar_position: 6
---

All React examples live under:

- `packages/react/examples`

## Minimal

| Example                                                                                                           | Purpose                          |
| ----------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| [`simple-flow.tsx`](https://github.com/rxova/journey/blob/main/packages/react/examples/simple-flow.tsx)           | Minimal provider + renderer flow |
| [`simple-back.flow.tsx`](https://github.com/rxova/journey/blob/main/packages/react/examples/simple-back.flow.tsx) | Basic `HISTORY_TARGET` usage     |
| [`go-to-jump.flow.tsx`](https://github.com/rxova/journey/blob/main/packages/react/examples/go-to-jump.flow.tsx)   | Programmatic step jumps          |

## Feature-Focused

| Example                                                                                                                                   | Purpose                    |
| ----------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| [`conditional-skip.flow.tsx`](https://github.com/rxova/journey/blob/main/packages/react/examples/conditional-skip.flow.tsx)               | Optional step routing      |
| [`first-match-wins.flow.tsx`](https://github.com/rxova/journey/blob/main/packages/react/examples/first-match-wins.flow.tsx)               | Transition precedence      |
| [`custom-event.flow.tsx`](https://github.com/rxova/journey/blob/main/packages/react/examples/custom-event.flow.tsx)                       | Custom event dispatch      |
| [`async-guard.flow.tsx`](https://github.com/rxova/journey/blob/main/packages/react/examples/async-guard.flow.tsx)                         | Async `when` with UI       |
| [`async-effect.flow.tsx`](https://github.com/rxova/journey/blob/main/packages/react/examples/async-effect.flow.tsx)                       | Async context updates      |
| [`dynamic-steps.flow.tsx`](https://github.com/rxova/journey/blob/main/packages/react/examples/dynamic-steps.flow.tsx)                     | Runtime graph updates      |
| [`reset-on-journey-change.flow.tsx`](https://github.com/rxova/journey/blob/main/packages/react/examples/reset-on-journey-change.flow.tsx) | Intentional provider reset |
| [`confirm-close.flow.tsx`](https://github.com/rxova/journey/blob/main/packages/react/examples/confirm-close.flow.tsx)                     | Dirty-close confirmation   |
| [`history-back.flow.tsx`](https://github.com/rxova/journey/blob/main/packages/react/examples/history-back.flow.tsx)                       | Branch-aware back UX       |

## Real Journey Scenarios

| Example                                                                                                                       | Domain                |
| ----------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| [`group-trip.flow.tsx`](https://github.com/rxova/journey/blob/main/packages/react/examples/group-trip.flow.tsx)               | Group travel planning |
| [`itinerary-builder.flow.tsx`](https://github.com/rxova/journey/blob/main/packages/react/examples/itinerary-builder.flow.tsx) | Itinerary building    |
| [`onboarding.flow.tsx`](https://github.com/rxova/journey/blob/main/packages/react/examples/onboarding.flow.tsx)               | Branching onboarding  |
| [`checkout.flow.tsx`](https://github.com/rxova/journey/blob/main/packages/react/examples/checkout.flow.tsx)                   | Checkout flow         |
| [`support-ticket.flow.tsx`](https://github.com/rxova/journey/blob/main/packages/react/examples/support-ticket.flow.tsx)       | Support intake        |

## Suggested Adoption Path

1. Start from `simple-flow.tsx`.
2. Add guards/effects from feature examples.
3. Validate behavior with one real-domain example close to your product workflow.
