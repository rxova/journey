---
id: linear
title: Linear
---

# Linear

A linear journey uses declared step order as its default forward path.

## Define a linear journey

```ts
import { createLinearJourney } from "@rxova/journey-core";

type StepId = "account" | "shipping" | "review";
type Context = { address: string };
type TerminationPayloads = {
  complete: { orderId: string };
  terminate: { reason: "cancelled" };
};

const machine = createLinearJourney<StepId, Context, TerminationPayloads>({
  steps: [
    "account",
    {
      id: "shipping",
      metadata: { title: "Shipping" },
      onLeave: async ({ snapshot }) => analytics.track("shipping_left", snapshot.context)
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

`goToStepById` is an intentionally ungated escape hatch for occasional jumps in an otherwise
ordered flow. It does not run next/previous work. If named jumps, guards, or branches become a
routine part of the flow, convert the definition to graph mode so those transitions become explicit.

Reaching the last step does not complete the journey:

```ts
machine.controls.complete();
```

The optional third factory generic groups completion and termination payload types and narrows
`snapshot.machine.outcome`. Omit it when terminal payload typing is not needed.

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

## Transactional navigation work

Both directions accept work that must succeed before movement. The optional `commit` applies staged
context updates atomically with the destination:

```ts
await machine.navigate.goToNextStep({
  run: async ({ snapshot }) => submitShipping(snapshot.context),
  commit: ({ result, updateContext }) => {
    updateContext((context) => ({ ...context, shippingId: result.id }));
  }
});

await machine.navigate.goToPreviousStep({
  run: async () => saveDraft()
});
```

Step `onLeave` and `onEnter` are awaited post-commit effects. Their failures are reported but cannot
roll navigation back.

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
