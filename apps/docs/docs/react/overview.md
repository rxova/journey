---
title: Overview
sidebar_position: 1
---

`@rxova/journey-react` is a thin React layer on top of `@rxova/journey-core`.

Use Core for all transition logic, history behavior, persistence rules, and machine semantics.
Use React bindings only to connect that machine to components.

## What React Adds

- `JourneyProvider`: provides a journey machine to the component tree.
- `JourneyStepRenderer`: renders the active step component.
- `useJourney`: reads snapshot and exposes navigation API.

## Recommended Workflow

1. Model and verify flow rules in Core first.
2. Add React components for each step.
3. Wire components through `JourneyProvider` and `JourneyStepRenderer`.

## Keep Concerns Separate

- Put branching, guards, and side effects in transitions.
- Keep step components focused on rendering and user interaction.

For machine details, see Core docs:

- `/docs/core/getting-started`
- `/docs/core/api`
- `/docs/core/recipes`
