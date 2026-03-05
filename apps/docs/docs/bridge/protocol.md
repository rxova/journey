---
title: Protocol
sidebar_position: 6
---

## Commands

```ts
type JourneyDevtoolsCommand =
  | { type: "goToNextStep" }
  | { type: "terminateMachine" }
  | { type: "completeJourney" }
  | { type: "goToStepById"; stepId: string }
  | { type: "goToPreviousStep"; steps?: number }
  | { type: "goToLastVisitedStep" }
  | { type: "updateStepMetadata"; stepId: string; metadata: unknown }
  | { type: "send"; event: { type: string; payload?: unknown } }
  | { type: "resetMachine" }
  | { type: "clearStepError"; stepId?: string };
```

## Snapshot Payload

Snapshots sent by bridge include:

- `currentStepId`
- `history.timeline`
- `history.index`
- `context`
- `visited`
- `stepMeta`
- `status`
- `async`
