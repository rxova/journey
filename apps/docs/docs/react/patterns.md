---
id: patterns
title: React Patterns
sidebar_label: Patterns
---

## Create Bindings Once Per Journey

```ts
const checkoutBindings = createJourneyBindings(checkoutJourney);
```

Keep bindings at module scope for stable references.

## Read + Actions Pattern

```tsx
const snapshot = checkoutBindings.useJourneySnapshot();
const api = checkoutBindings.useJourneyApi();
```

- read current UI state from `snapshot`
- perform actions through `api`

## Split Render and Controls

- render current step with `checkoutBindings.StepRenderer`
- keep global controls (`goToNextStep`/`goToPreviousStep`/`terminateJourney`) in separate components using `useJourneyApi`

## External Machine Injection

Use `Provider` with `machine` prop when you need shared ownership outside React.

## Journey Swap Strategy

- default: preserve internal machine when `journey` prop changes
- set `resetOnJourneyChange` to `true` when journey updates should reinitialize state
