---
title: Bridge API
sidebar_position: 3
---

`attachJourneyDevtools(machine, options?)` connects a Journey machine to the devtools channel.

Use it when you want live snapshot streaming, core observation-event streaming, and optional remote command/query control from the Journey Devtools panel.

## Basic Usage

```ts
import { attachJourneyDevtools } from "@rxova/journey-devtools-bridge";

const detach = attachJourneyDevtools(machine, {
  machineId: "checkout-main",
  label: "Checkout Flow",
  appName: "Storefront",
  pluginMetadata: {
    persistence: {
      key: "checkout-journey",
      clearOnReset: true
    }
  }
});

// later
// detach();
```

The bridge is observational by default. It does not call `machine.startJourney()` for you, so fresh machines remain `idled` until your app starts them.

## Options

### `machineId?: string`

Unique id for this machine instance.

- If omitted, bridge generates one automatically.
- Use explicit ids when multiple machines exist in the same page/app.

### `label?: string`

Human-readable machine label shown in devtools.

- Default: `"Journey Machine"`

### `appName?: string`

App name shown in the devtools registration metadata.

- Default: `document.title` when available, otherwise `null`.

### `enabled?: boolean`

Turns bridge transport on/off.

- Default behavior: enabled when `import.meta.env.DEV` is true, disabled when `import.meta.env.PROD` is true, otherwise falls back to `NODE_ENV !== "production"`
- Production default: disabled
- Non-browser environments: no-op

### `commandsEnabled?: boolean`

Controls whether the panel can send mutating commands back to the machine.

- Default behavior: enabled when `import.meta.env.DEV` is true, disabled when `import.meta.env.PROD` is true, otherwise falls back to `NODE_ENV !== "production"`
- Production default: disabled
- Useful when you want read-only inspection in production-like environments.

### `pluginMetadata?: { persistence?: { key?: string; clearOnReset?: boolean } }`

Optional metadata surfaced in the devtools registration payload for plugin-backed machine features that are not structurally discoverable from the machine object.

- Current use: persistence plugin metadata
- Displayed in the panel capability summary
- Does not change machine behavior; this is devtools-facing metadata only

## Local vs Production Behavior

Default behavior is safety-first:

- Local/development: bridge and commands are enabled by default when `import.meta.env` or `process.env.NODE_ENV` exposes a non-production runtime.
- Production: bridge is disabled by default.
- Production with bridge enabled: commands are still disabled by default.
- No env signal available: bridge and commands remain disabled unless explicitly enabled.

Enable explicitly in production only when intended:

```ts
attachJourneyDevtools(machine, {
  enabled: true,
  commandsEnabled: true
});
```

## Command Support

The bridge can execute these commands from the panel:

### Navigation

- `goToNextStep`
- `goToStepById`
- `goToPreviousStep`
- `goToLastVisitedStep`

### Lifecycle / Control

- `completeJourney`
- `terminateJourney` (mapped internally to core `terminateJourney`)
- `startJourney`
- `resetJourney`

### State Updates

- `clearStepError`

### Read-only Queries

- `getExecutionPaths`

### Custom Event Dispatch

- `send` (for custom machine events)

This command model allows both high-level controls and lower-level event testing.

When `commandsEnabled` is `false`, mutating commands are blocked, but read-only `getExecutionPaths` remains available when the machine exposes `getExecutionPaths()`.

## Snapshot Payload

Bridge serializes and sends a transport-safe snapshot payload with:

- navigation: `currentStepId`, `history.timeline`, `history.index`
- runtime data: `context`, `visited`
- lifecycle/async: `status`, `async`

Example payload:

```ts
{
  currentStepId: "payment",
  history: {
    timeline: ["start", "details", "payment"],
    index: 2
  },
  context: { isVip: false },
  visited: {
    start: true,
    details: true,
    payment: true,
    review: false
  },
  status: "running",
  async: {
    isLoading: false,
    byStep: {
      payment: {
        phase: "idle",
        eventType: null,
        transitionId: null,
        error: null
      }
    }
  }
}
```

For exact command and envelope types, see [Protocol](/docs/bridge/protocol).

## Additional Streams

In protocol v4 the bridge also emits:

- `observation` envelopes mirroring core `JourneyObservationEvent`
- `executionPathsResult` envelopes for read-only execution-path queries

The Journey Devtools panel uses these to render event rows in the timeline and inspect structural execution paths without mutating the machine.
