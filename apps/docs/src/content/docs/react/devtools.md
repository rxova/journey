---
title: "Devtools Bridge (Chrome)"
---

Install the [Journey Chrome DevTools extension](https://chromewebstore.google.com/detail/rxova-journey-devtools/bkmdccobpcagbmknjmmhbabcfphinjcm).

A graph Provider owns its machine, so expose that mount with `machineRef`:

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

A linear bundle's Provider works the same way: pass a ref through its `machineRef` prop and attach
the current machine in an effect. For headless React, attach the same Core machine passed to the
hooks.

The bridge is disabled in production by default. An explicitly enabled bridge permits mutations
unless `mutationsEnabled: false` is supplied. Always return the detach function.
