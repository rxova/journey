---
title: "Protocol"
---

The bridge and Chrome extension communicate through versioned `window.postMessage` envelopes. Most
applications never construct an envelope directly, but the format matters when diagnosing
compatibility, reviewing security, or building a custom consumer.

## Versions

The current protocol is **v7**.

| Version | Status                   | Notes                                                                         |
| ------- | ------------------------ | ----------------------------------------------------------------------------- |
| v7      | Current                  | Carries the redesigned immutable Core snapshot and required mutation metadata |
| v6      | Prior, invoke-compatible | Uses the same invoke shape, so a v6 panel can drive a v7 bridge               |
| v5      | Legacy, read-only        | Tolerated for registration during rolling upgrades; cannot invoke             |

Compatibility is deliberately asymmetric. Register envelopes from all three known versions can be
recognized, while only v6 and v7 invoke envelopes are accepted.

## Base envelope

Every normal protocol message contains:

```ts
type EnvelopeBase = {
  channel: "__RXOVA_JOURNEY_DEVTOOLS__";
  version: 5 | 6 | 7;
  source: "rxova-journey-bridge" | "rxova-journey-extension";
  kind: string;
  machineId: string;
  timestamp: number;
};
```

The channel and source fields keep unrelated page messages out of the protocol parser. The machine
ID routes extension requests when several journeys are attached in one tab.

## Bridge-to-extension messages

The bridge emits:

- `register`: metadata, feature descriptors, mutation policy, and the current snapshot;
- `unregister`: the machine detached;
- `snapshot`: the next immutable snapshot;
- `observation`: a named Core subscription payload without a duplicate snapshot;
- `operationResult`: a successful generic operation result;
- `operationError`: validation, policy, rate-limit, or runtime failure.

A registration describes operations generically:

```ts
{
  id: "core.goToPreviousStep",
  label: "Previous",
  description: "...",
  mutates: true,
  output: "snapshot",
  fields: [
    { key: "steps", label: "Steps", type: "integer" }
  ]
}
```

Consumers should render from descriptors instead of maintaining a hard-coded command list. Plugin
and future operation groups can then participate without changing the envelope format.

## Extension-to-bridge invokes

An invoke carries a request ID and operation identity:

```ts
{
  kind: "invoke",
  requestId: "request-42",
  invocation: {
    operationId: "core.goToPreviousStep",
    input: { steps: 2 }
  }
}
```

The bridge resolves the descriptor, validates fields, checks `mutationsEnabled`, applies the rate
limit, runs the operation, and responds with the same request ID. Unknown operation IDs and
malformed inputs produce `operationError` rather than reaching the machine.

## Registration metadata

A v7 register includes:

- `machineId`, `label`, and `appName`;
- required `mutationsEnabled`;
- machine `mode` and declared step IDs when known;
- optional full graph `eventTypes`;
- optional authored per-step feature hints;
- feature groups and generic operation descriptors.

The register also embeds a snapshot, which lets a newly opened panel render immediately without
waiting for the next machine change.

## Snapshot envelope

Protocol v7 transports the current Core snapshot. Shared fields are:

```ts
{
  type: ("linear" | "graph", status, context, transition, history, machine, plugins, currentStep);
}
```

`currentStep` is `null` while idle and otherwise includes `id`, `metadata`,
`isFirstTimeVisit`, and per-entry `async` state. `history` contains `timeline`,
`currentIndex`, `visited`, `canGoBack`, and `canGoForward`. `machine` contains lifecycle
booleans, the broad loading flag, and terminal outcome.

Linear snapshots add declared-order `steps` data and current-step index flags. Graph snapshots add
`declaredEvents`, `availableEvents`, `availableSteps`, and candidate-level
`outgoingTransitions`.

## Observations and replay discovery

Observation events are `stepEnter`, `stepLeave`, `statusChange`, `contextChange`,
`navigationBlocked`, and `error`. Their snapshot field is omitted on the wire because snapshots
stream independently.

When the panel opens after a machine was already attached, the extension sends a replay-discovery
request. Each live bridge responds by re-emitting its register envelope and current snapshot.

## Validation and safety limits

Parsers validate the channel, known version/source, envelope-specific fields, operation descriptors,
payload depth, and serialized size. The bridge also verifies the page origin and rate-limits
operations. These are robustness boundaries, not a secret channel: other scripts executing in the
same page can observe page-level `postMessage` traffic.
