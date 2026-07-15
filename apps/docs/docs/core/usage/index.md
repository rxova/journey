---
id: index
title: Choosing a mode
sidebar_label: Choosing a mode
---

# Choosing a mode

Journey has two definition shapes. They share one runtime and machine API.

| Choose             | When                                           | Primary movement                  |
| ------------------ | ---------------------------------------------- | --------------------------------- |
| [Linear](./linear) | The declared step order is the default path.   | `machine.navigate.goToNextStep()` |
| [Graph](./graph)   | Named events and guards choose among branches. | `machine.send(type, payload?)`    |

Start linear when the flow is fundamentally ordered. You can still jump by id and traverse history.
Choose graph when the transition itself is a domain event such as `SUBMIT`, `APPROVE`, or `RETRY`,
or when multiple guarded candidates may handle the same event.

## What stays the same

Both shapes provide:

- the same `controls`, `navigate`, `subscriptions`, and `context` groups;
- immutable snapshots with status, context, history, current-step async state, and plugin data;
- transactional next/previous work and post-commit lifecycle hooks;
- explicit completion and termination;
- the same plugin contract.

The snapshot `type` field narrows shape-specific data:

```ts
const snapshot = machine.getSnapshot();

if (snapshot.type === "linear") {
  snapshot.currentStep?.isLastStep;
} else {
  snapshot.availableEvents;
}
```

## Where to next

- [Linear](./linear)
- [Graph](./graph)
- [Transitions syntax](../api/transitions-syntax)
