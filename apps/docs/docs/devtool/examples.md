---
title: Complete Examples
sidebar_position: 6
---

This page provides realistic usage patterns for both core and react apps.

## Example 1: Core Checkout Machine

```ts
import {
  createJourneyMachine,
  HISTORY_TARGET,
  JOURNEY_TERMINAL,
  type JourneyDefinition
} from "@rxova/journey-core";
import { attachJourneyDevtools } from "@rxova/journey-devtools-bridge";

type Step = "cart" | "details" | "review" | "done";
type Event = "next" | "back" | "submit";
type Ctx = { email: string; hasValidationError: boolean };

const journey: JourneyDefinition<Ctx, Step, Event> = {
  initial: "cart",
  context: { email: "", hasValidationError: false },
  steps: { cart: {}, details: {}, review: {}, done: {} },
  transitions: [
    { from: "cart", event: "next", to: "details" },
    {
      from: "details",
      event: "next",
      to: "review",
      when: ({ context }) => context.email.length > 0
    },
    { from: "*", event: "back", to: HISTORY_TARGET },
    { from: "review", event: "submit", to: JOURNEY_TERMINAL.COMPLETE }
  ]
};

const machine = createJourneyMachine(journey);
attachJourneyDevtools(machine, {
  machineId: "checkout-main",
  label: "Checkout",
  appName: "Storefront"
});
```

## Example 2: React + Provider + Bridge

```tsx
import { useEffect } from "react";
import {
  JourneyProvider,
  JourneyStepRenderer,
  useJourney,
  useJourneyMachine,
  type JourneyReactDefinition
} from "@rxova/journey-react";
import { attachJourneyDevtools } from "@rxova/journey-devtools-bridge";

type Step = "start" | "profile" | "finish";
type Event = "next" | "submit";
type Ctx = { name: string };

const DebugBridge = () => {
  const machine = useJourneyMachine<Ctx, Step, Event>();

  useEffect(() => {
    return attachJourneyDevtools(machine, {
      machineId: "profile-setup",
      label: "Profile Setup"
    });
  }, [machine]);

  return null;
};

const Start = () => {
  const { api } = useJourney<Ctx, Step, Event>();
  return <button onClick={() => void api.next()}>Continue</button>;
};

const journey: JourneyReactDefinition<Ctx, Step, Event> = {
  initial: "start",
  context: { name: "" },
  steps: {
    start: { component: Start },
    profile: { component: () => <div>Profile</div> },
    finish: { component: () => <div>Done</div> }
  },
  transitions: [
    { from: "start", event: "next", to: "profile" },
    { from: "profile", event: "submit", to: "finish" }
  ]
};

export const App = () => (
  <JourneyProvider journey={journey}>
    <DebugBridge />
    <JourneyStepRenderer<Ctx, Step, Event> />
  </JourneyProvider>
);
```

## Example 3: Multiple Machines In One Page

```ts
const detachCheckout = attachJourneyDevtools(checkoutMachine, {
  machineId: "checkout",
  label: "Checkout"
});

const detachProfile = attachJourneyDevtools(profileMachine, {
  machineId: "profile",
  label: "Profile Completion"
});

const detachSupport = attachJourneyDevtools(supportMachine, {
  machineId: "support",
  label: "Support Ticket"
});

// during teardown
// detachCheckout();
// detachProfile();
// detachSupport();
```

## Example 4: Controlled Production Enablement

```ts
const shouldEnableDevtools =
  process.env.NODE_ENV !== "production" ||
  (typeof window !== "undefined" && window.location.search.includes("journeyDebug=1"));

attachJourneyDevtools(machine, {
  enabled: shouldEnableDevtools,
  label: "Risk Review"
});
```

## Example 5: Validating Async Errors From Panel

1. Send a custom event from panel that triggers async guard/effect.
2. If it fails, inspect `async.byStep[step].error` in Async tab.
3. Use `clearStepError` command to reset UI state.

This workflow helps isolate whether failures come from guard logic, effect side effects, or malformed payloads.
