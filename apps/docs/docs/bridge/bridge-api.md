---
title: Bridge API
sidebar_label: Bridge API
---

# Bridge API

`attachJourneyDevtools(machine, options?)` connects a current Core linear or graph machine to the
Journey Chrome DevTools channel. It registers the machine, streams immutable snapshots and named
observations, exposes generic operation descriptors, and returns a detach function.

```ts
import { attachJourneyDevtools } from "@rxova/journey-devtools-bridge";

const detach = attachJourneyDevtools(machine, {
  machineId: "checkout",
  label: "Checkout",
  appName: "Storefront",
  eventTypes: ["continue", "cancel"],
  mutationsEnabled: false
});
```

## Options

| Option                   | Default                      | Purpose                                               |
| ------------------------ | ---------------------------- | ----------------------------------------------------- |
| `machineId`              | generated                    | Stable identity in the panel                          |
| `label`                  | `"Journey Machine"`          | Human-readable machine label                          |
| `appName`                | `document.title`             | Application label                                     |
| `enabled`                | true only outside production | Enables the page transport                            |
| `mutationsEnabled`       | true whenever enabled        | Permits operations marked mutating                    |
| `eventTypes`             | omitted                      | Full declared graph event list for stable panel forms |
| `rateLimit.maxPerWindow` | 100                          | Maximum invokes in one window                         |
| `rateLimit.windowMs`     | 10,000                       | Rate-limit window duration                            |

Environment detection uses the repository's non-production resolver. When detection is unavailable,
it fails conservatively. Set `enabled` explicitly when build tooling cannot expose the environment
reliably.

`mutationsEnabled` is a separate decision from `enabled`. If a bridge is enabled, mutations are
allowed unless the option is false.

## Lifecycle behavior

Attachment does not start or alter the machine. A newly created machine remains idle until
`controls.start()` or an `autoStart` factory option takes effect.

On attachment, the bridge posts one register envelope containing metadata, generic feature
descriptors, and the current snapshot. It then subscribes to snapshot changes and all named Core
observation events.

The returned function:

1. unsubscribes from the machine;
2. removes the page message listener;
3. posts an unregister envelope;
4. becomes a safe no-op if called again.

Outside the browser, or when disabled, attachment immediately returns a no-op detach function.

## Operations

The bridge builds operations from the attachable machine surface. Core operations cover valid
lifecycle controls, navigation, context updates, graph events where available, and async error
clearing. Plugins can contribute namespaced operations through their advertised features.

Each operation has a stable ID, user-facing label, optional description, typed field descriptors, a
mutation flag, and an output kind. The panel builds its forms from these descriptors.

Incoming invokes are rejected when:

- the operation ID is unknown;
- the input does not satisfy the descriptor;
- the operation mutates and `mutationsEnabled` is false;
- the request exceeds the configured rate limit;
- the protocol version is not invoke-compatible.

Machine failures are serialized into operation results or operation errors; they are not thrown
through the message listener.

## Snapshot serialization

The bridge clones the Core snapshot for transport. Protocol v7 preserves the discriminated linear or
graph shape, including current-step async state, history pointer, machine outcome, plugin snapshot
extensions, and graph routing introspection.

Snapshot/context values must be serializable enough for structured transport. Functions, DOM nodes,
and class instances do not belong in journey context.

## Security guidance

The transport is same-page `window.postMessage`. Origin, payload, envelope, and rate checks improve
robustness, but another script executing in the page can observe or attempt to emit page-level
messages.

For sensitive applications:

- keep the bridge disabled in production unless there is a deliberate debugging need;
- when enabled, prefer `mutationsEnabled: false`;
- avoid credentials, tokens, and personal secrets in context or metadata;
- keep operation rate limits enabled;
- call detach during teardown;
- review third-party scripts that execute in the inspected page.

See [Protocol](./protocol) for the exact envelope model.
