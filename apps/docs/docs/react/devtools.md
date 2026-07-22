---
title: Devtools Bridge (Chrome)
sidebar_position: 7
---

Install the [Journey Chrome DevTools extension](https://chromewebstore.google.com/detail/rxova-journey-devtools/bkmdccobpcagbmknjmmhbabcfphinjcm).

A graph bundle's machine is standalone — created by the factory, not by a Provider — so attach to
`bundle.machine` directly:

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

A linear bundle's Provider creates its machine per mount instead: pass a ref through its
`machineRef` prop and attach the current machine in an effect. For headless React, attach the same
Core machine passed to the hooks.

The bridge is disabled in production by default. An explicitly enabled bridge permits mutations
unless `mutationsEnabled: false` is supplied. Always return the detach function.
