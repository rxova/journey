---
id: examples
title: Examples
sidebar_label: Examples
---

# Examples

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
  const [machine, setMachine] = React.useState(null);

  React.useEffect(() => {
    if (!machine) return;
    return attachJourneyDevtools(machine, {
      label: "Checkout",
      mutationsEnabled: false
    });
  }, [machine]);

  return (
    <checkout.Provider views={views} machineRef={setMachine}>
      <checkout.StepRenderer />
    </checkout.Provider>
  );
}
```

`machineRef` exposes the machine owned by that Provider mount. The callback receives `null` on
unmount, and the Provider disposes its machine.
