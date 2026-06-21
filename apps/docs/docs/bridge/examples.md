---
id: examples
title: Examples
sidebar_label: Examples
---

# Examples

A few ways to wire the bridge into a real app. The bridge is observational by default and a no-op
outside the browser, so it's safe to attach unconditionally in development.

## Attach to a core machine

```ts
import { createGraphJourney } from "@rxova/journey-core";
import { attachJourneyDevtools } from "@rxova/journey-devtools-bridge";

const machine = createGraphJourney(journey);

const detach = attachJourneyDevtools(machine, {
  machineId: "checkout",
  label: "Checkout Journey"
});

machine.startJourney();

// later, on teardown
// detach();
```

## Attach in a React app

With `@rxova/journey-react`, attach once to the shared runtime's `machine` — outside render, or in an
effect that returns the `detach` cleanup:

```tsx
import { useEffect } from "react";
import { attachJourneyDevtools } from "@rxova/journey-devtools-bridge";
import { checkoutJourney } from "./checkout-journey";

export const DevtoolsBridge = () => {
  useEffect(
    () =>
      attachJourneyDevtools(checkoutJourney.machine, {
        machineId: "checkout",
        label: "Checkout Journey"
      }),
    []
  );
  return null;
};
```

## Inspect in production, read-only

Enable the transport but block mutations so the panel can observe without driving the machine:

```ts
attachJourneyDevtools(machine, { enabled: true, mutationsEnabled: false });
```

## What the panel can invoke

The panel drives the machine through the **operations** the bridge advertises — core navigation and
lifecycle (`goToNextStep`, `goToStepById`, `goToPreviousStep`, `completeJourney`, `resetJourney`,
`clearStepError`, …), custom event dispatch, and read-only plugin queries such as execution-paths
inspection. Mutating operations require `mutationsEnabled`. See [Bridge API](./bridge-api) for the
full list and [Protocol](./protocol) for the wire shapes.

## Where to next

- [Bridge API](./bridge-api) — options and what the bridge streams.
- [Protocol](./protocol) — envelopes, operations, and versioning.
