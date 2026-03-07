---
id: examples
title: React Examples
sidebar_label: Examples
---

Use this page as a guide to common React integration scenarios.

React examples focus on wiring and component patterns.
For runtime internals, pair them with Core docs.

## Example Scenarios

### 1) Basic Bindings Setup

What it shows:

- `createJourneyBindings`
- `Provider`
- `StepRenderer`

Start from: `/docs/react/quickstart`

### 2) Controlled Navigation

What it shows:

- `goToNextStep`, `goToPreviousStep`, `goToLastVisitedStep`
- explicit event sending via `api.send(...)`

Runtime semantics live in: `/docs/core/api` and `/docs/core/history`

### 3) Async UI

What it shows:

- reading `snapshot.async`
- loading/error rendering
- `clearStepError`

Runtime async rules live in: `/docs/core/async`

### 4) Metadata Updates

What it shows:

- `updateStepMetadata` from React actions

Runtime metadata events live in: `/docs/core/lifecycle`

### 5) External Machine Ownership

What it shows:

- passing `machine` into `Provider`
- integrating React with externally managed runtime

### 6) Journey Switching

What it shows:

- `resetOnJourneyChange`
- `resetOnPersistenceChange`
- state preservation vs full reset behavior

## Full Integration Reference

For an end-to-end setup (core + react + bridge), see the demo app in this repository.
