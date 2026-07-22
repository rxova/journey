---
title: "Devtools Bridge (Chrome)"
---

Install the [Journey Chrome DevTools extension](https://chromewebstore.google.com/detail/rxova-journey-devtools/bkmdccobpcagbmknjmmhbabcfphinjcm).

A bundle's machine — linear or graph — is standalone, created by the factory rather than by a
Provider, so attach to `bundle.machine` directly:

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

The same call also works at module scope, outside React entirely. For a caller-owned Core machine,
attach the machine you render from with `useSyncExternalStore`.

The bridge is disabled in production by default. An explicitly enabled bridge permits mutations
unless `mutationsEnabled: false` is supplied. Always return the detach function.
