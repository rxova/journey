---
title: Bridge API
sidebar_label: Bridge API
---

# Bridge API

`attachJourneyDevtools(machine, options?)` connects a Journey machine to the devtools channel and
returns a `detach` function. Once attached, the bridge streams snapshots and observation events to
the panel and — when you allow it — lets the panel drive the machine back.

It's observational by default: attaching does **not** start the machine, so a fresh machine stays
`idled` until your app calls `startJourney()`.

```ts
import { attachJourneyDevtools } from "@rxova/journey-devtools-bridge";

const detach = attachJourneyDevtools(machine, {
  machineId: "checkout-main",
  label: "Checkout Flow",
  appName: "Storefront"
});

// later, e.g. on unmount
// detach();
```

## Options

`JourneyDevtoolsBridgeOptions` (full type in the [API reference](./api/reference/type-aliases/JourneyDevtoolsBridgeOptions.md)):

| Option             | Default               | Purpose                                                         |
| ------------------ | --------------------- | --------------------------------------------------------------- |
| `machineId`        | generated             | Stable id; set it when several machines share a page            |
| `label`            | `"Journey Machine"`   | Human-readable name in the panel                                |
| `appName`          | `document.title`      | App name in the registration metadata                           |
| `enabled`          | on outside production | Force the bridge on or off                                      |
| `mutationsEnabled` | on outside production | Allow the panel to mutate the machine (navigate, patch context) |

:::note Safety-first defaults
Both `enabled` and `mutationsEnabled` default on only in non-production builds (resolved from
`import.meta.env` or `NODE_ENV`), and the bridge is a no-op outside the browser. Enable them
explicitly to inspect a production build. `commandsEnabled` is a deprecated alias for
`mutationsEnabled`.
:::

## What the bridge streams

- **Snapshots** — every machine snapshot change is serialized to a transport-safe payload
  (`currentStepId`, `history`, `context`, `visited`, `status`, `async`) and sent as a `snapshot`
  envelope. The per-step async `phase` includes `invoking` for a running [effect](/docs/core/effects).
- **Observations** — every `JourneyObservationEvent` is forwarded as an `observation` envelope, so
  the panel can render a live event timeline.
- **Register metadata** — on attach the bridge sends the machine's mode, step ids, event types,
  invokable operations, and (as of protocol v6) per-step features. See [Protocol](./protocol).

## What the panel can invoke

The bridge advertises a set of **operations** the panel can invoke — core navigation and lifecycle
(`goToNextStep`, `goToStepById`, `goToPreviousStep`, `goToLastVisitedStep`, `completeJourney`,
`terminateJourney`, `startJourney`, `resetJourney`, `clearStepError`), custom event dispatch
(`send`), context edits, and read-only plugin queries such as execution-paths inspection.

When `mutationsEnabled` is `false`, mutating operations are rejected while read-only queries still
run. Each invocation resolves to an `operationResult` or `operationError` — see [Protocol](./protocol).

## Where to next

- [Getting started](./getting-started) — install and attach the bridge.
- [Protocol](./protocol) — the envelope shapes and versioning.
- [API reference](./api/reference/) — exact types for options, envelopes, and guards.
