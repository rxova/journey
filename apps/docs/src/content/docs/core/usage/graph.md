---
title: "Graph"
---

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

Guards are synchronous and pure because the runtime also evaluates them while deriving graph
transition introspection.

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

## Transactional sends: event work

An event can carry the async that decides its own outcome. With the
[graph builder](../api/graph-builder), `work` pairs a `run`/`commit` with the candidates that route
on what `commit` staged — so the call site stays a bare `send`, and the definition owns both the
async and the routing:

```ts
const cart = createStep("cart", {
  on: {
    CHECKOUT: ({ work }) =>
      work({
        run: ({ snapshot, handlers }) => handlers.api.charge(snapshot.context.items),
        commit: ({ result, updateContext }) =>
          updateContext((context) => ({
            ...context,
            error: result.charged ? null : "Charge failed."
          })),
        candidates: ({ to, stay }) => [
          to("receipt").when(({ result }) => result.charged),
          // stay(): a failed charge still routes (back here), so its outcome commits.
          stay()
        ]
      })
  }
});
```

Work is keyed by `(step, event)`: two steps can declare the same event with different work and
different candidates. Candidates come in two forms: a plain array (guards see `context` and
`handlers`), or — as above — a callback receiving a work-scoped `to` and `stay` whose guards
additionally see the typed run `result`. Routing facts like `result.charged` therefore never need
to be persisted in context; `commit` stages only business state.

A work send is a transaction. The exact order:

1. `run` executes while the machine holds the current step; `snapshot.transition` reports the
   `"working"` phase and no destination yet.
2. `commit` receives `run`'s result. Its `updateContext` writes to a **staged** copy of the context,
   not the live one.
3. The candidates are evaluated **against the staged context and the run result**, in declaration
   order. The first enabled candidate wins.
4. If no candidate is enabled, the staged context is **discarded** and `send` returns
   `{ ok: false, reason: "no-enabled-transition" }`. Either the send routed and committed, or
   neither happened — a work send never half-lands.

Rule 4 has a practical consequence, the **totality rule**: any outcome that must persist needs an
enabled candidate to carry it. A success outcome routes forward; a failure outcome that should keep
its staged context (an error message, an attempt counter) needs a fallback candidate. `stay()` is
the named form of that fallback: an unguarded candidate back at the current step. Without one, a
failed run's staged context is rolled back with the unmatched send — which is why the builder warns
at build time when every candidate of a work declaration is guarded. An intentionally partial event
declares `allowRollback: true` on the work to silence it.

Three follow-ups worth knowing:

- A self-transition (including `stay()`) is an ordinary move. There is no `from === to` special
  case: the step's `onLeave` and `onEnter` both run again, `onTransition` fires, and the step's
  visit count increments.
- `onTransition` runs after the destination commits (see the next section) — by then the staged
  context **is** the context.
- Snapshot introspection evaluates guards outside any send, so a guard that reads `result` sees it
  as `undefined` there — details on the [snapshot page](../snapshot#graph-snapshot).

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
snapshot.declaredEvents; // all event names declared from the current step
snapshot.availableEvents; // enabled event names from the current step
snapshot.availableSteps; // enabled target ids from the current step
snapshot.outgoingTransitions; // every candidate with priority and evaluated guard state
snapshot.currentStep?.isTerminal; // no outgoing transitions are declared
snapshot.steps.totalSteps;
snapshot.steps.visitedStepCount;
```

`outgoingTransitions` keeps guarded-out candidates visible. Each descriptor contains `event`, `to`,
`priority`, `guard` (`"none"`, `"passed"`, or `"failed"`), `enabled`, and `selected`. `selected` marks
the first enabled candidate that `send(event)` would choose; a later candidate may be enabled but
not selected. The snapshot exposes evaluated state only, never the guard function.

## Where to next

- [Graph builder](../api/graph-builder)
- [Transitions syntax](../api/transitions-syntax)
- [Async behavior](../async)
