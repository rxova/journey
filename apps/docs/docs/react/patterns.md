---
id: patterns
title: React Patterns
sidebar_label: Patterns
---

These patterns keep React code clean while Journey core remains the runtime source of truth.

## Create The Journey Once Per Flow

```ts
const checkoutJourney = createJourney(checkoutDefinition);
```

Keep the journey at module scope when possible so references stay stable across renders.

Why it helps:

- hook typing is captured once
- views stay separate from runtime definition
- multiple journeys can coexist safely with separate closures

## Read And Actions Split

```tsx
const snapshot = checkoutJourney.useJourneySnapshot();
const api = checkoutJourney.useJourneyApi();
```

Use `snapshot` to read state and `api` to change state.

## Prefer Selector Reads For Focused Components

```tsx
const currentStepId = checkoutJourney.useJourneySelector((snapshot) => snapshot.currentStepId);
const isLoading = checkoutJourney.useJourneySelector((snapshot) => snapshot.async.isLoading);
```

Use `useJourneySelector` when a component depends on only part of the snapshot.
Use `useJourneySnapshot` when it genuinely needs the full object.

## Keep Step Rendering Separate From Global Controls

- render the current step with `checkoutJourney.StepRenderer`
- keep shared controls in separate components using `checkoutJourney.useJourneyApi()`

This keeps step views focused on step concerns and shared controls focused on navigation concerns.

## Use The Provider Only For Views

```tsx
<checkoutJourney.JourneyProvider views={checkoutViews}>
  <checkoutJourney.StepRenderer />
</checkoutJourney.JourneyProvider>
```

Hooks do not need the provider. The provider only supplies the view map and lifecycle callbacks for `StepRenderer`.

## Creating A Journey Inside A Component

If you need dynamic journey creation in React, memoize it and opt into provider-owned disposal:

```tsx
function App() {
  const journey = React.useMemo(() => createJourney(definition), []);

  return (
    <journey.JourneyProvider views={views} disposeOnUnmount>
      <journey.StepRenderer />
    </journey.JourneyProvider>
  );
}
```

## Devtools And Other Integrations

Use `journey.machine` directly when wiring external tools such as the devtools bridge.

## Keep Runtime Questions In Core Docs

Patterns here are React wiring patterns.

For runtime semantics, use Core docs:

- transition and lifecycle semantics: [Core Lifecycle](/docs/core/lifecycle)
- async guard behavior: [Core Async Behavior](/docs/core/async)
- history pointer model: [Core Timeline Navigation](/docs/core/history)
