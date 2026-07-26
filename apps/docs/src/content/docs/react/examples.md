---
title: "React Examples"
sidebar:
  label: "Examples"
---

Use this page as a guide to common React integration scenarios.

React examples focus on wiring and component patterns.
For runtime internals, pair them with Core docs.

## Example Scenarios

### 1. Basic `createJourney` Setup

What it shows:

- `createJourney(definition, options?)`
- separate `views`
- `JourneyProvider`
- `StepRenderer`

Start from: `/docs/react/quickstart`

### 2. Provider-Free Hooks

What it shows:

- `useJourneySnapshot()`
- `useJourneyApi()`
- `useJourneySelector()`
- `useJourneyEvent()`

Use this when components need machine state or actions but are not part of step rendering.

### 3. Controlled Navigation

What it shows:

- `goToNextStep`
- `goToPreviousStep`
- `goToLastVisitedStep`
- explicit event sending via `api.send(...)`

Runtime semantics live in: `/docs/core/api` and `/docs/core/history`

### 4. Async UI

What it shows:

- reading `snapshot.async`
- loading and error rendering
- `clearStepError`

Runtime async rules live in: `/docs/core/async`

### 5. Step Metadata Reads

What it shows:

- `getStepMeta(stepId)` from React actions or selectors

Step metadata semantics live in: `/docs/core/api`

### 6. Devtools Bridge Integration

What it shows:

- passing `journey.machine` to `attachJourneyDevtools(...)`

### 7. Inside-Component Journey Creation

What it shows:

- `useMemo(() => createJourney(...), [])`
- `disposeOnUnmount` for provider-owned cleanup

## Full Integration Reference

For an end-to-end setup across core, react, and the devtools bridge, see the demo app in this repository.
