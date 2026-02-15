---
title: Core Examples
sidebar_position: 10
---

All headless examples live under:

- `packages/core/examples`

## Minimal

| Example                                                                                                                | Purpose                                      |
| ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| [`simple-flow.flow.ts`](https://github.com/rxova/journey/blob/main/packages/core/examples/simple-flow.flow.ts)         | Minimal linear `next -> next -> submit` flow |
| [`simple-back.flow.ts`](https://github.com/rxova/journey/blob/main/packages/core/examples/simple-back.flow.ts)         | Basic `HISTORY_TARGET` back behavior         |
| [`simple-sequence.flow.ts`](https://github.com/rxova/journey/blob/main/packages/core/examples/simple-sequence.flow.ts) | Tiny sequence model                          |
| [`go-to-jump.flow.ts`](https://github.com/rxova/journey/blob/main/packages/core/examples/go-to-jump.flow.ts)           | Programmatic `goTo` jumps                    |

## Feature-Focused

| Example                                                                                                                                | Purpose                       |
| -------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| [`conditional-skip.flow.ts`](https://github.com/rxova/journey/blob/main/packages/core/examples/conditional-skip.flow.ts)               | Optional step routing         |
| [`first-match-wins.flow.ts`](https://github.com/rxova/journey/blob/main/packages/core/examples/first-match-wins.flow.ts)               | Transition priority behavior  |
| [`custom-event.flow.ts`](https://github.com/rxova/journey/blob/main/packages/core/examples/custom-event.flow.ts)                       | Custom events with `send`     |
| [`async-guard.flow.ts`](https://github.com/rxova/journey/blob/main/packages/core/examples/async-guard.flow.ts)                         | Async `when` validation       |
| [`async-effect.flow.ts`](https://github.com/rxova/journey/blob/main/packages/core/examples/async-effect.flow.ts)                       | Async `effect` context update |
| [`dynamic-steps.flow.ts`](https://github.com/rxova/journey/blob/main/packages/core/examples/dynamic-steps.flow.ts)                     | Runtime graph rebuilds        |
| [`reset-on-journey-change.flow.ts`](https://github.com/rxova/journey/blob/main/packages/core/examples/reset-on-journey-change.flow.ts) | Controlled machine recreation |
| [`confirm-close.flow.ts`](https://github.com/rxova/journey/blob/main/packages/core/examples/confirm-close.flow.ts)                     | Dirty-close confirmation      |
| [`history-back.flow.ts`](https://github.com/rxova/journey/blob/main/packages/core/examples/history-back.flow.ts)                       | Branch-aware back navigation  |

## Real Journey Scenarios

| Example                                                                                                                    | Domain                |
| -------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| [`group-trip.flow.ts`](https://github.com/rxova/journey/blob/main/packages/core/examples/group-trip.flow.ts)               | Group travel planning |
| [`itinerary-builder.flow.ts`](https://github.com/rxova/journey/blob/main/packages/core/examples/itinerary-builder.flow.ts) | Itinerary composition |
| [`onboarding.flow.ts`](https://github.com/rxova/journey/blob/main/packages/core/examples/onboarding.flow.ts)               | Multi-path onboarding |
| [`checkout.flow.ts`](https://github.com/rxova/journey/blob/main/packages/core/examples/checkout.flow.ts)                   | Purchase funnel       |
| [`support-ticket.flow.ts`](https://github.com/rxova/journey/blob/main/packages/core/examples/support-ticket.flow.ts)       | Support intake flow   |

## How to Use This Catalog

1. Start from a minimal example closest to your flow.
2. Layer in features (`when`, `effect`, persistence, history policy).
3. Add tests around transition behavior before UI integration.
