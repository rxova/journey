---
title: Protocol
sidebar_position: 6
---

## Commands

```ts
type JourneyDevtoolsCommand =
  | { type: "startJourney" }
  | { type: "goToNextStep" }
  | { type: "terminateJourney" }
  | { type: "completeJourney" }
  | { type: "goToStepById"; stepId: string }
  | { type: "goToPreviousStep"; steps?: number }
  | { type: "goToLastVisitedStep" }
  | { type: "send"; event: { type: string; payload?: unknown } }
  | { type: "resetJourney" }
  | { type: "clearStepError"; stepId?: string }
  | { type: "getExecutionPaths"; options?: { maxDepth?: number; maxPaths?: number } };
```

## Register Metadata

Protocol version is `4`.

Register envelopes now include capability metadata:

- `meta.capabilities.commands`
- `meta.capabilities.observe`
- `meta.capabilities.executionPaths`
- `meta.capabilities.persistence` (optional bridge-supplied metadata)

## Compatibility Contract

Protocol version is the compatibility boundary.

- Incompatible command, envelope, or payload shape changes require a protocol version bump.
- Panel and bridge consumers should upgrade together across protocol-version changes.
- Additive metadata and additive fields are preferred over mutating existing shapes in place.
- The bridge is tooling-facing. The runtime contract still lives in Core and React.

## Bridge Envelopes

Bridge-origin envelopes now include:

- `register`
- `snapshot`
- `observation`
- `commandResult`
- `executionPathsResult`
- `commandError`
- `unregister`

## Snapshot Payload

Snapshots sent by bridge include:

- `currentStepId`
- `history.timeline`
- `history.index`
- `context`
- `visited`
- `status`
- `async`

## Observation Payload

`observation` envelopes mirror core `JourneyObservationEvent` field names, with nested payloads/errors cloned to transport-safe JSON values.

## Execution Path Query Result

`executionPathsResult` envelopes return:

- `result.paths`
- `result.truncated`
- `result.cyclesDetected`

See the shared [Stability Contract](/docs/core/stability) for the broader support guarantees.
