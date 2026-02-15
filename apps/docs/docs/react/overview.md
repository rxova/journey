---
title: Overview
sidebar_position: 1
---

`@rxova/journey-react` is a thin React layer on top of `@rxova/journey-core`.

Use Core for transition rules/history/persistence semantics. Use React for rendering, hooks, and ergonomics.

## What React Package Adds

- `JourneyProvider`: creates or accepts a machine and exposes it through context.
- `JourneyStepRenderer`: renders `journey.steps[snapshot.current].component`.
- `useJourneySnapshot`: subscribes to snapshot changes.
- `useJourneyApi`: imperative navigation and machine helpers.
- `useJourney`: combined snapshot + API convenience hook.

## Mental Model

1. Define journey graph in Core terms (`steps`, `transitions`, `context`).
2. Attach React step components.
3. Keep UI components thin; call API helpers for events.
4. Read snapshot for rendering state (including async phases).

## Why This Separation Matters

- deterministic behavior stays testable in headless mode
- UI stays focused on user interaction and rendering
- migration/persistence/history policies stay centralized

## Key Pages

- `/docs/react/quickstart`
- `/docs/react/provider-and-hooks`
- `/docs/react/patterns`
- `/docs/react/async-ui`
- `/docs/react/examples`

Core references:

- `/docs/core/getting-started`
- `/docs/core/api`
- `/docs/core/history`
- `/docs/core/persistence`
