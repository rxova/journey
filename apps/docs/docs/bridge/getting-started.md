---
title: Getting Started
sidebar_position: 2
---

import Tabs from "@theme/Tabs";
import TabItem from "@theme/TabItem";

This guide gets you from zero to a bridge-ready setup while the Chrome extension listing is under review.

## 1) Install Bridge In Your App

<Tabs groupId="package-managers" defaultValue="pnpm">
  <TabItem value="pnpm" label="pnpm">

```bash
pnpm add @rxova/journey-devtools-bridge
```

  </TabItem>
  <TabItem value="yarn" label="yarn">

```bash
yarn add @rxova/journey-devtools-bridge
```

  </TabItem>
  <TabItem value="npm" label="npm">

```bash
npm install @rxova/journey-devtools-bridge
```

  </TabItem>
</Tabs>

## 2) Attach Bridge To A Machine

### Core Example

```ts
import { createJourneyMachine } from "@rxova/journey-core";
import { attachJourneyDevtools } from "@rxova/journey-devtools-bridge";

const machine = createJourneyMachine(journey);

const detachDevtools = attachJourneyDevtools(machine, {
  machineId: "checkout-main",
  label: "Checkout Flow",
  appName: "Storefront"
});

// optional cleanup
// detachDevtools();
```

### React Example

```tsx
import { useEffect } from "react";
import { attachJourneyDevtools } from "@rxova/journey-devtools-bridge";
import { checkoutBindings } from "./checkout-bindings";

export const JourneyDebugBridge = () => {
  const machine = checkoutBindings.useJourneyMachine();

  useEffect(() => {
    return attachJourneyDevtools(machine, {
      machineId: "onboarding",
      label: "Onboarding Journey"
    });
  }, [machine]);

  return null;
};
```

## 3) Extension Availability

The `Rxova Journey Devtools` Chrome extension is currently pending Chrome Web Store approval.

For now, this public guide does not include local unpacked extension setup.

What you can do now:

- keep bridge integration in place
- verify events and transitions in your app runtime
- prepare unique `machineId` and readable `label` values for fast debugging once the extension is available

We will publish the store install link here as soon as approval is complete.

## 4) Open DevTools Panel (After Approval)

1. Install `Rxova Journey Devtools` from the Chrome Web Store.
2. Open your app page.
3. Open Chrome DevTools.
4. Select the `Journey` panel.

If bridge messages are flowing, connection state should change to connected.

## 5) Validate End-To-End (After Approval)

Do this quick check:

1. Trigger UI event in app (e.g. `goToNextStep`).
2. Confirm `currentStepId` updates in Snapshot tab.
3. Send `goToPreviousStep` command from panel.
4. Confirm app returns to previous step.

## First Successful Session Screenshot

![Journey Devtools Connected Session](/img/devtool/panel-overview.png)

## Default Runtime Behavior

If you do nothing else:

- Bridge is enabled in development when `import.meta.env` or `process.env.NODE_ENV` exposes a non-production runtime.
- Bridge is disabled in production.
- No-op in non-browser environments.
- If neither env source is available, bridge defaults to disabled.

To force production enablement:

```ts
attachJourneyDevtools(machine, { enabled: true });
```

## Common Setup Pitfalls

- Bridge is attached before machine exists: attach after machine creation.
- Multiple machines with same `machineId`: use unique ids.
- Extension not yet available publicly: wait for Chrome Web Store approval and use bridge-only validation meanwhile.
