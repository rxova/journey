---
id: graph
title: Graph
---

# Graph

A graph journey moves through named events. Each event can have one transition candidate or an
ordered list of guarded candidates.

## Define a graph journey

```ts
import { createGraphJourney } from "@rxova/journey-core";

type Event =
  | { type: "SUBMIT"; payload: { email: string } }
  | { type: "APPROVE" }
  | { type: "EDIT" };

const machine = createGraphJourney<{ valid: boolean }, "form" | "review" | "done", Event>({
  initial: "form",
  context: { valid: false },
  steps: {
    form: {},
    review: {},
    done: {}
  },
  transitions: {
    SUBMIT: { from: "form", to: "review", when: ({ context }) => context.valid },
    APPROVE: { from: "review", to: "done" },
    EDIT: { from: "review", to: "form" }
  }
});
```

## Send typed events

`send` takes an event type and, when the declared event has one, its payload as a second argument.

```ts
machine.controls.start();
await waitUntilSettled(machine);

await machine.send("SUBMIT", { email: "ada@example.com" });
await machine.send("APPROVE");
```

The [Quickstart](../getting-started) defines `waitUntilSettled`. It waits for initial entry work;
without that wait an immediate send can correctly return `reason: "transitioning"`.

The first candidate whose `from` matches the current step and whose guard returns `true` wins. If no
candidate is enabled, `send` returns `{ ok: false, reason: "no-enabled-transition" }`.

## Guards and handlers

Guards are synchronous and pure because the runtime also evaluates them while deriving
`availableEvents` and `availableSteps`.

```ts
const definition = {
  initial: "form" as const,
  context: { role: "member" },
  handlers: { canApprove: (role: string) => role === "admin" },
  steps: { form: {}, done: {} },
  transitions: {
    APPROVE: {
      from: "form",
      to: "done",
      when: ({ context, handlers }) => handlers.canApprove(context.role)
    }
  }
};

const testMachine = createGraphJourney(definition, {
  handlers: { canApprove: () => true }
});
```

Creation options can replace definition handlers, which keeps one definition reusable in tests.

## Transition and step effects

`onTransition` runs after the destination commits and before the destination step's `onEnter`.
Neither can cancel the committed move.

```ts
transitions: {
  SUBMIT: {
    from: "form",
    to: "review",
    onTransition: async ({ event, snapshot, updateContext, raise }) => {
      updateContext((context) => ({ ...context, email: event?.payload.email ?? "" }));
      raise({ type: "APPROVE" });
    }
  }
}
```

Raised events run FIFO after the current transition fully settles. Long cascades are capped by
`MAX_RAISED_EVENTS` and reported through the `error` subscription event.

## Navigation helpers

Graph machines still expose `navigate`:

- timeline back/forward navigation retraces realized history without transition gating;
- `goToStepById(id)` succeeds only when an enabled outgoing transition targets `id`;
- `goToNextStep()` only moves forward through existing timeline history. It does not choose an
  arbitrary graph edge.

Step `onLeave` still runs for all of these moves.

## Graph snapshot fields

```ts
const snapshot = machine.getSnapshot();

snapshot.type; // "graph"
snapshot.availableEvents; // enabled event names from the current step
snapshot.availableSteps; // enabled target ids from the current step
snapshot.currentStep?.isTerminal; // no outgoing transitions are declared
snapshot.steps.totalSteps;
snapshot.steps.visitedStepCount;
```

## Where to next

- [Graph builder](../api/graph-builder)
- [Transitions syntax](../api/transitions-syntax)
- [Async behavior](../async)
