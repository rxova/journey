---
id: linear
title: Linear
---

# Linear

A linear journey uses declared step order as its default forward path.

## Define a linear journey

```ts
import { createLinearJourney } from "@rxova/journey-core";

const machine = createLinearJourney({
  steps: [
    "account",
    {
      id: "shipping",
      metadata: { title: "Shipping" },
      onLeave: async ({ snapshot }) => validateShipping(snapshot.context)
    },
    {
      id: "review",
      onEnter: ({ raise }) => {
        // `raise` is a no-op for linear journeys.
      }
    }
  ] as const,
  context: { address: "" }
});
```

The first declared step is the initial step. Duplicate ids and empty step arrays are rejected at
creation time.

## Navigation

```ts
machine.controls.start();
await waitUntilSettled(machine);

await machine.navigate.goToNextStep();
await machine.navigate.goToPreviousStep();
await machine.navigate.goToStepById("review");
await machine.navigate.goToLastVisitedStep();
```

`controls.start()` commits the initial step synchronously but returns before async initial entry work
settles. `waitUntilSettled` is the small selector-based helper from the [Quickstart](../getting-started);
UI integrations can instead disable navigation while `snapshot.transition.pending` is true.

- `goToNextStep()` follows the timeline forward when the pointer is behind its tip. At the tip, it
  falls back to the next step in declared order.
- `goToPreviousStep(n)` moves the history pointer back and clamps to the first timeline entry.
- `goToStepById(id)` may jump to any declared linear step and appends a new timeline entry.
- `goToLastVisitedStep()` moves the pointer to the timeline tip.

Moving forward from an older history position uses the existing timeline. A new jump from an older
position truncates the abandoned future before appending the destination.

Reaching the last step does not complete the journey:

```ts
machine.controls.complete();
```

## Linear snapshot fields

```ts
const snapshot = machine.getSnapshot();

snapshot.type; // "linear"
snapshot.steps.stepOrder;
snapshot.steps.totalSteps;
snapshot.steps.visitedStepCount;
snapshot.currentStep?.index;
snapshot.currentStep?.isFirstStep;
snapshot.currentStep?.isLastStep;
```

Metadata is available on the current step as `snapshot.currentStep.metadata`.

## Hooks

`onLeave` runs before a move commits. Returning `false`, rejecting, or timing out prevents the move.
`onEnter` runs after commit and cannot roll it back.

```ts
const machine = createLinearJourney(
  {
    steps: [
      {
        id: "form",
        onLeave: ({ snapshot }) => snapshot.context.valid
      },
      {
        id: "done",
        onEnter: async ({ snapshot }) => audit(snapshot.context)
      }
    ] as const,
    context: { valid: false }
  },
  { defaultTimeoutMs: 5_000 }
);
```

## Convert to a graph

Use the optional `@rxova/journey-core/convert` entry when an ordered flow grows event-driven
branches:

```ts
import { linearToGraphDefinition } from "@rxova/journey-core/convert";

const graphDefinition = linearToGraphDefinition(linearDefinition);
```

Adjacent steps become `NEXT` and `PREVIOUS` transitions. Pass `{ includeJumpEvents: true }` to add a
`GO_TO_<ID>` event for every step.

## Where to next

- [Step behavior](./step-behavior)
- [Timeline and history](../history)
- [Graph](./graph)
