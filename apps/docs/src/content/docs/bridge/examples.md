---
title: "Examples"
---

## Core machine

```ts
const machine = createGraphJourney(definition, {
  autoStart: true,
  plugins: [createExecutionPathsPlugin()] as const
});

const detach = attachJourneyDevtools(machine, {
  machineId: "checkout",
  label: "Checkout graph",
  eventTypes: ["continue", "cancel"],
  mutationsEnabled: true
});
```

## Inspect-only production session

```ts
attachJourneyDevtools(machine, {
  enabled: true,
  mutationsEnabled: false
});
```

Enabling the bridge does not make it inspect-only. Supply `mutationsEnabled: false` whenever the
panel must be unable to navigate, change context, or invoke another mutating operation.

## React graph Provider

```tsx
function Checkout() {
  React.useEffect(
    () =>
      attachJourneyDevtools(checkout.machine, {
        label: "Checkout",
        mutationsEnabled: false
      }),
    []
  );

  return (
    <checkout.Provider views={views}>
      <checkout.StepRenderer />
    </checkout.Provider>
  );
}
```

The bundle's machine is standalone, so devtools attach to `checkout.machine` directly — in an
effect as above, or at module scope right after the factory call. React never disposes it.
