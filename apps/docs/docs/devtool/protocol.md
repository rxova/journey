---
title: Protocol And Message Flow
sidebar_position: 5
---

The devtool uses a versioned envelope protocol over `window.postMessage` and extension messaging.

## Envelope Contract

Shared constants:

- `channel`: `__RXOVA_JOURNEY_DEVTOOLS__`
- `version`: `1`

All envelopes carry:

- `source`
- `kind`
- `machineId`
- `timestamp`

## Source Values

- `rxova-journey-bridge`
- `rxova-journey-extension`

## Bridge -> Extension Kinds

- `register`
- `snapshot`
- `unregister`
- `commandResult`
- `commandError`

## Extension -> Bridge Kind

- `command`

## Command Schema

```ts
type JourneyDevtoolsCommand =
  | { type: "next" }
  | { type: "back" }
  | { type: "close" }
  | { type: "submit" }
  | { type: "goTo"; to: string }
  | { type: "send"; event: { type: string; payload?: unknown } }
  | { type: "reset" }
  | { type: "clearStepError"; stepId?: string }
  | { type: "clearHistory" }
  | { type: "trimHistory"; maxHistory?: number | null };
```

## End-To-End Flow

1. Bridge emits `register` + initial snapshot.
2. Content script forwards to background with tab context.
3. Panel subscribes to tab stream via background port.
4. Panel emits `command` with `requestId`.
5. Background routes command to content script.
6. Content script posts command to window.
7. Bridge executes machine API.
8. Bridge emits `commandResult` or `commandError` with same `requestId`.

## Example Envelopes

### `register`

```json
{
  "channel": "__RXOVA_JOURNEY_DEVTOOLS__",
  "version": 1,
  "source": "rxova-journey-bridge",
  "kind": "register",
  "machineId": "checkout",
  "timestamp": 1730000000000,
  "meta": {
    "machineId": "checkout",
    "label": "Checkout Flow",
    "appName": "Storefront"
  },
  "snapshot": {
    "current": "start",
    "status": "running",
    "context": { "cartSize": 2 },
    "history": [],
    "visited": ["start"],
    "async": { "isLoading": false, "byStep": {} }
  }
}
```

### `command`

```json
{
  "channel": "__RXOVA_JOURNEY_DEVTOOLS__",
  "version": 1,
  "source": "rxova-journey-extension",
  "kind": "command",
  "machineId": "checkout",
  "requestId": "req-42",
  "timestamp": 1730000001000,
  "command": {
    "type": "send",
    "event": { "type": "retry", "payload": { "attempt": 2 } }
  }
}
```

### `commandError`

```json
{
  "channel": "__RXOVA_JOURNEY_DEVTOOLS__",
  "version": 1,
  "source": "rxova-journey-bridge",
  "kind": "commandError",
  "machineId": "checkout",
  "requestId": "req-42",
  "timestamp": 1730000001100,
  "error": {
    "name": "Error",
    "message": "send failed",
    "stack": "...",
    "cause": null
  }
}
```

## Robustness Rules

- Ignore unknown channel/version/source/kind.
- Ignore commands for different machine id.
- Guard all envelope parsing with strict type guards.
- Preserve correlation through `requestId`.
