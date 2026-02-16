---
title: Bridge API
sidebar_position: 3
---

The bridge package is the app-side contract.

## `attachJourneyDevtools(machine, options?)`

```ts
const detach = attachJourneyDevtools(machine, options);
```

### Parameters

- `machine`: any `JourneyMachine` (core or react-provided)
- `options`:
  - `machineId?: string`
  - `label?: string`
  - `enabled?: boolean`
  - `appName?: string`
  - `commandsEnabled?: boolean`

### Return Value

- `detach(): void`
  - unsubscribes machine listener
  - removes message listener
  - emits `unregister`

## Option Semantics

### `machineId`

- If omitted, an id is generated automatically.
- Use explicit ids for stable debugging across reloads and to avoid collisions.

### `label`

- Human-readable display value in panel machine selector.
- Keep short and unique per page (`Checkout`, `Profile`, `Consent`).

### `enabled`

- Defaults to enabled only when `NODE_ENV` is defined and not `"production"`.
- Defaults to disabled when `NODE_ENV` is unavailable.
- Set `true` to force runtime enablement.
- Set `false` to hard-disable bridge.

### `appName`

- Optional app/group label for multi-app pages.
- Displayed next to machine label.

### `commandsEnabled`

- Defaults to enabled only when `NODE_ENV` is defined and not `"production"`.
- Defaults to disabled when `NODE_ENV` is unavailable.
- Set to `false` to force inspect-only behavior.
- Set to `true` to allow commands in production environments.

## Command Handling

The bridge listens for extension `command` envelopes and executes machine APIs:

- event sends:
  - `next`, `back`, `close`, `submit`
  - `goTo`
  - custom `send`
- sync APIs:
  - `reset`
  - `clearStepError`
  - `clearHistory`
  - `trimHistory`

On completion it emits either:

- `commandResult` with updated snapshot (and transition metadata when available)
- `commandError` with serialized error

## Safety Guarantees

- Unknown `machineId` commands are ignored.
- Unknown or malformed envelopes are ignored.
- Only same-origin extension command messages are accepted.
- Errors in command execution do not break bridge listener lifecycle.
- Snapshot payloads are transport-safe cloned.
- Rate limiting protects command handling from bursts (100 commands per 10-second window).
- Payload validation applies depth, size, and shape constraints before execution.

## Threat Model Boundaries

- The command channel uses `window.postMessage` on the same page.
- Same-origin scripts can still emit command-like envelopes.
- For sensitive contexts, prefer inspect-only mode (`commandsEnabled: false`).
- Security controls here are defense-in-depth (origin checks, message guards, rate limits, payload constraints), not a hard boundary against malicious same-page scripts.

## Practical Patterns

### Single Machine App

```ts
attachJourneyDevtools(machine, { label: "Main Journey" });
```

### Multi-Machine App

```ts
attachJourneyDevtools(checkoutMachine, {
  machineId: "checkout",
  label: "Checkout"
});

attachJourneyDevtools(profileMachine, {
  machineId: "profile",
  label: "Profile Completion"
});
```

### Explicit Production Opt-In

```ts
attachJourneyDevtools(machine, {
  enabled: process.env.NODE_ENV === "production" && window.location.search.includes("debug=journey")
});
```

## React Bridge Component Example

```tsx
import { useEffect } from "react";
import { useJourneyMachine } from "@rxova/journey-react";
import { attachJourneyDevtools } from "@rxova/journey-devtools-bridge";

export const JourneyDevtoolsBridge = ({
  machineId,
  label
}: {
  machineId: string;
  label: string;
}) => {
  const machine = useJourneyMachine();

  useEffect(() => {
    return attachJourneyDevtools(machine, { machineId, label });
  }, [machine, machineId, label]);

  return null;
};
```
