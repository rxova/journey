---
id: overview
title: Devtool Overview
sidebar_label: Overview
---

Journey devtools has two parts:

- `@rxova/journey-devtools-bridge`: runtime message bridge.
- Devtools panel app: visualization + controls.

## Protocol Version

Bridge protocol uses a fixed internal compatibility version.

## Snapshot Payload Focus

The panel consumes:

- `history.timeline` and `history.index` (pointer model)
- `currentStepId`, `visited`, `stepMeta`
- `status` and `async`

## Command Surface

- `goToNextStep`, `terminateMachine`, `completeJourney`, `resetMachine`
- `goToStepById`
- `goToPreviousStep`
- `goToLastVisitedStep`
- `updateStepMetadata`
- `send`
- `clearStepError`

## Time Travel UX

Panel supports:

- Redux-style timeline inspector rows with local selection
- follow-latest toggle and point-in-time `Action` / `State` / `Diff` inspection

Inspector selection does not mutate runtime machine state.
