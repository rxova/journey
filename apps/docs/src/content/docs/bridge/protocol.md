---
title: Protocol
sidebar_label: Protocol
---

# Protocol

The bridge and the devtools extension talk over `window.postMessage` using a small, versioned
envelope protocol. You rarely touch it directly — `attachJourneyDevtools` and the panel handle both
ends — but understanding the shapes helps when debugging a connection or building your own consumer.

Every message is an envelope tagged with a `channel`, a `version`, a `source`
(`rxova-journey-bridge` or `rxova-journey-extension`), a `kind`, and the `machineId` it concerns. The
exact types are in the [API reference](./api/reference/) — `JourneyDevtoolsBridgeEnvelope`,
`JourneyDevtoolsExtensionEnvelope`, and the guards `isJourneyDevtoolsEnvelope` /
`isJourneyDevtoolsBridgeEnvelope` / `isJourneyDevtoolsExtensionEnvelope`.

## Versioning

The current protocol version is **6** (`JOURNEY_DEVTOOLS_PROTOCOL_VERSION`). The bridge also accepts
the prior version **5** (`JOURNEY_DEVTOOLS_PRIOR_PROTOCOL_VERSION`) and tolerates the legacy version
**3** for register envelopes.

:::info v5 ↔ v6 interoperate
v6 only **added** the optional `meta.steps` field to the register envelope. The `invoke` envelope
shape is unchanged, so a v6 bridge and a v5 extension work together — a v5 extension ignores the new
field, and the bridge processes v5 invokes (`isCompatibleInvokeProtocolVersion` gates this).
:::

Protocol version is the compatibility boundary: any breaking change to an envelope or payload shape
bumps it, and additive optional fields are preferred over mutating existing shapes.

## Bridge → extension envelopes

The bridge emits one of these `kind`s:

| Kind              | When                                        | Key payload                          |
| ----------------- | ------------------------------------------- | ------------------------------------ |
| `register`        | On attach (and on replay request)           | `meta` + initial `snapshot`          |
| `snapshot`        | On every machine snapshot change            | `snapshot`                           |
| `observation`     | On every `JourneyObservationEvent`          | `event` (transport-safe clone)       |
| `operationResult` | An invoked operation succeeded              | `requestId`, `operationId`, `result` |
| `operationError`  | An invoked operation failed or was rejected | `requestId`, `operationId`, `error`  |
| `unregister`      | On detach                                   | —                                    |

## Register metadata

The `register` envelope carries a `JourneyDevtoolsMachineMeta` describing the machine statically:

- `machineId`, `label`, `appName`, `mutationsEnabled`
- `mode` — `"linear" | "graph" | "headless"`
- `stepIds`, `eventTypes`, `eventTypesBySource`, `goToStepTargetsBySource`
- `features` — the invokable operation groups (core navigation plus plugin features)
- `steps` — **new in v6**: per-step authored features, so the panel can show which steps carry an
  effect, delayed transitions, lifecycle callbacks, or metadata:

```ts
steps: {
  verify: {
    hasEffect: true,
    afterDelays: [], // delays (ms) of the step's `after` transitions
    hasOnEnter: true,
    hasOnLeave: false,
    hasMeta: true
  }
}
```

## Snapshot payload

`register` and `snapshot` envelopes carry a transport-safe `JourneyDevtoolsSerializableSnapshot` —
`currentStepId`, `history.timeline`, `history.index`, `context`, `visited`, `status`, and `async`.
The per-step async phase is one of `idle`, `evaluating-when`, `invoking`, or `error`:

```ts
async: {
  isLoading: true,
  byStep: {
    verify: { phase: "invoking", eventType: null, transitionId: null, error: null }
  }
}
```

:::note `invoking` since v6
The `invoking` phase (a step [effect](/docs/core/effects) is running) is reported as of protocol v6.
Earlier bridges collapsed it to `idle`.
:::

## Extension → bridge envelopes

The extension sends a single `kind`, `invoke`, to run an operation the bridge advertised in
`meta.features`:

```ts
{
  kind: "invoke",
  requestId: "req-1",
  invocation: {
    operationId: "core.goToNextStep",
    input: { /* validated against the operation's field spec */ }
  }
}
```

The bridge replies with a matching `operationResult` (a `snapshot`, `data`, `text`, or `void`
payload) or an `operationError`. Mutating operations are blocked unless the bridge was attached with
`mutationsEnabled`. A replay request asks the bridge to re-emit its `register` + `snapshot`.

## Where to next

- [Bridge API](./bridge-api) — `attachJourneyDevtools` and its options.
- [API reference](./api/reference/) — the exact envelope, meta, and guard types.
- [Stability contract](/docs/core/stability) — the broader support guarantees.
