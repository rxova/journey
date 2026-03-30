---
title: Navigation Commit Logic
sidebar_label: Navigation Commits
---

Source file: `packages/core/src/journey-machine/navigation.ts`

This file owns the actual snapshot commits for movement.

It does not choose which transition wins. That work lives in `send.ts`. Once a target is known, navigation turns
that decision into a new snapshot and the right lifecycle events.

## How It Works

1. `applyPreviousNavigation(...)` moves the history pointer backward without destroying the existing timeline. It
   normalizes the requested step count, emits `step.exit`, commits the new snapshot with reason `"navigation"`,
   emits `navigation.previous`, then emits `step.enter`.
2. `applyLastVisitedNavigation(...)` jumps the pointer to the realized tail of the timeline. This is useful when a
   user inspected an older point and should return to the current tail.
3. `commitTerminalTransition(...)` keeps the realized timeline up to the current pointer, updates status to
   `"completed"` or `"terminated"`, and emits `journey.completed` or `journey.terminated`.
4. `commitStepTransition(...)` validates the target step, emits `step.exit` when the current step changes, commits
   the next snapshot, emits `transition.success`, and finally emits `step.enter`.

Headless `goToStepById(...)` navigation also lands here. `send.ts` decides when a direct jump is allowed, then
delegates the actual snapshot write to `commitStepTransition(...)`.

The key design is that history is a realized path plus a pointer, not just a current index into the authored step
registry. That is what lets Journey model non-linear flows without losing what actually happened.

## Recommended Reading

- Read [Send Pipeline](/docs/core/architecture/send) for transition selection and fallback rules.
- Read [Helpers](/docs/core/architecture/helpers) for `transitionSnapshot(...)` and snapshot-building utilities.
- Read [History](/docs/core/history) for the public explanation of the timeline model.
- Read [Snapshot](/docs/core/snapshot) if you want the exact shape this file commits.
