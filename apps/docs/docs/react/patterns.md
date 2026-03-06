---
id: patterns
title: React Patterns
sidebar_label: Patterns
---

These patterns help keep React code clean while Journey core remains the runtime source of truth.

## Create Bindings Once Per Journey

```ts
const checkoutBindings = createJourneyBindings(checkoutJourney);
```

Keep bindings at module scope so references stay stable across renders.

Why it helps:

- hook typing is captured once
- no repeated generic noise at callsites
- multiple journeys can coexist safely with separate bindings

## Read + Actions Split

```tsx
const snapshot = checkoutBindings.useJourneySnapshot();
const api = checkoutBindings.useJourneyApi();
```

Use `snapshot` to read state and `api` to change state.

This makes render logic easier to scan and reduces accidental side effects in UI code.

## Prefer Selector Reads for Focused Components

```tsx
const currentStepId = checkoutBindings.useJourneySelector((snapshot) => snapshot.currentStepId);
const isLoading = checkoutBindings.useJourneySelector((snapshot) => snapshot.async.isLoading);
```

Use `useJourneySelector` when the component depends on only part of snapshot.
Use `useJourneySnapshot` when the component genuinely needs the full snapshot object.

## Separate Step Rendering from Global Controls

- render current step with `checkoutBindings.StepRenderer`
- keep global controls (next/back/terminate) in separate components using `useJourneyApi`

This keeps step components focused on step concerns and shared controls focused on navigation concerns.

## External Machine Ownership

If machine lifecycle is managed outside React, inject it through `Provider`:

```tsx
<checkoutBindings.Provider machine={externalMachine}>
  <checkoutBindings.StepRenderer />
</checkoutBindings.Provider>
```

Useful when integrating with devtools bridge, orchestrators, or host shells.

## Journey Swap Strategy

When `journey` prop changes on `Provider`:

- default behavior preserves internal machine state
- set `resetOnJourneyChange={true}` to reinitialize from the new journey

Choose based on product intent:

- preserve state for live configuration updates
- reset state for hard flow replacement

## Keep Runtime Questions in Core Docs

Patterns here are React wiring patterns.

For runtime semantics, use Core docs:

- transition and lifecycle semantics: [Core Lifecycle](/docs/core/lifecycle)
- async guard/effect behavior: [Core Async Behavior](/docs/core/async)
- history pointer model: [Core Timeline Navigation](/docs/core/history)
