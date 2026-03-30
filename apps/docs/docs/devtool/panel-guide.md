---
title: Panel Guide
sidebar_position: 4
---

## Timeline Inspector

The panel uses a Redux-style inspector layout:

- Left side: timeline rows (`@@INIT`, `SNAPSHOT/<step>`, `COMMAND/<type>`, `ERROR/<type|requestId>`).
- Right side: tabs for `Action`, `State`, and `Diff`.
- Selection is local/read-only and does not mutate inspected runtime state.

## Timeline Controls

- **Follow latest**: keeps selection pinned to newest row.
- **Display limit**: limits rows rendered in the panel.
- **Prune to limit**: truncates retained rows for the active machine.

## Command Controls

Built-ins:

- `startJourney`, `goToNextStep`, `terminateJourney`, `completeJourney`, `resetJourney`
- `goToStepById`
- `goToPreviousStep`
- `goToLastVisitedStep`
- custom `send`
- `clearStepError`
