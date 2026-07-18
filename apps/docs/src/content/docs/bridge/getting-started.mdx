---
title: Getting Started
sidebar_position: 2
---

The bridge connects a Journey Core machine running in the inspected page to the Journey Chrome
DevTools panel.

## Install the extension

Install [Journey DevTools from the Chrome Web Store](https://chromewebstore.google.com/detail/rxova-journey-devtools/bkmdccobpcagbmknjmmhbabcfphinjcm).
After installation, open Chrome DevTools and select the **Journey** tab.

## Install the bridge

```bash
npm install @rxova/journey-devtools-bridge
```

The bridge is a runtime dependency of the inspected application. The Chrome extension itself is not
bundled into the app.

## Attach a Core machine

```ts
import { createLinearJourney } from "@rxova/journey-core";
import { attachJourneyDevtools } from "@rxova/journey-devtools-bridge";

const machine = createLinearJourney(definition, {
  autoStart: true
});

const detach = attachJourneyDevtools(machine, {
  machineId: "checkout",
  label: "Checkout",
  appName: "Storefront"
});
```

The panel should show a machine labelled Checkout. Its first register envelope already includes the
current immutable snapshot.

Attachment is observational with respect to lifecycle: it does not start, pause, resume, navigate,
complete, or terminate the machine. Use `autoStart: true` or call
`machine.controls.start()` when your application is ready.

## Choose the mutation policy

Once the bridge is enabled, mutating DevTools operations are allowed by default. Use inspect-only
mode when the panel should be unable to navigate or change context:

```ts
attachJourneyDevtools(machine, {
  mutationsEnabled: false
});
```

Read-only inspection and plugin queries remain available.

The bridge itself is enabled by default only outside production. To deliberately inspect a
production build, both decisions should be explicit:

```ts
attachJourneyDevtools(machine, {
  enabled: true,
  mutationsEnabled: false
});
```

## Graph event forms

A graph snapshot reports currently available events, but the panel may need the entire declared
union to build a stable event selector. Supply it through `eventTypes`:

```ts
attachJourneyDevtools(graphMachine, {
  eventTypes: ["continue", "skip", "cancel"]
});
```

## React-owned machines

A graph Provider creates the machine during mount. Capture that mount with `machineRef` and attach
it in an effect:

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

Returning the detach function removes message listeners and unregisters the machine. The Provider
sets the ref to `null` and disposes its machine on unmount.

## Troubleshooting checklist

1. Confirm the extension is installed and the Journey panel is open.
2. Confirm the attached machine is running in the inspected tab, not an iframe or another tab.
3. Check that `enabled` was not forced to false.
4. Confirm the panel and bridge are protocol compatible.
5. Inspect Content Security Policy and extension injection errors in the panel.
6. Verify the snapshot changes at `currentStep.id` and `history.currentIndex` when the app moves.

See [Bridge API](./bridge-api), [Protocol](./protocol), and
[DevTools troubleshooting](/docs/devtool/troubleshooting).
