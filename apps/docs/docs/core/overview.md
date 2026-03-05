# Overview

## Motivation

Most wizard/stepper implementations start as a linear list of steps plus a pointer (`currentIndex`). That works well for simple next/previous navigation in a fixed order.

The problem starts when the product grows. You add conditions, branching, step skipping, revisits, async checks, and context-dependent rules. Logic spreads across components, and one pointer no longer explains the real path a user took.

At that point, behavior gets hard to reason about and easy to break. Logic spreads inside the steps, and there is no longer a single source of truth.

Journey solves this by making the journey graph explicit in one place. Rules stay centralized, so behavior is easier to read, test, and debug. It also includes first-class TypeScript support, built-in history, and optional versioned `localStorage` persistence.

### Important Difference: Index vs ID Navigation

Most steppers move by index (`goToStepByIndex(2)`). That is fragile: add, remove, or reorder a step, and index-based jumps can point to the wrong place.

Journey moves by stable step ids (`"details"`, `"payment"`, `"review"`). Transition rules target ids, and direct jumps use `goToStepById`.

That means flow intent survives refactors and branching.

## Proof of concept

Let's take a look at an example.
A simple React wizard may start like this:

```tsx
const App = () => (
  <Wizard>
    <Step1 />
    <Step2 />
    <Step3 />
  </Wizard>
);
```

Each step then calls helpers like `goToPreviousStep`, `goToNextStep`, and `goToStepByIndex`.

That feels easy at first, but as rules grow, each step starts making its own decisions:

```tsx
const Step2 = () => {
  const { goToNextStep, goToStepById } = useWizard();

  const onNext = async () => {
    if (!formIsValid()) return;
    const isVip = await checkVip();

    if (isVip) return goToStepByIndex(2); // manually skipping a step
    return goToNextStep();
  };

  return <button onClick={() => void onNext()}>Next</button>;
};
```

Now imagine many steps doing this. The flow rules are spread out, so it is hard to see the full map. Add to that confirmations to close a flow for example, that usually sit outisde the wizard layer because stacking isn't easy to reproduce.

With Journey Core, you define the graph once and run it with the machine API:

```ts
import {
  createJourneyMachine,
  createTransitions,
  tx,
  type JourneyDefinition
} from "@rxova/journey-core";

type StepIds = "details" | "payment" | "review";
type CustomEvents = "applyCoupon";
type Context = { isVip: boolean };

const journey: JourneyDefinition<Context, StepIds, Event> = {
  initial: "details",
  context: { isVip: false },
  steps: {
    details: {},
    payment: {},
    review: {}
  },
  transitions: createTransitions(
    tx
      .from("details")
      .on("goToNextStep")
      .choose(tx.when(({ context }) => context.isVip).to("review"), tx.otherwise().to("payment")),
    tx.from("payment").on("applyCoupon").to("review"),
    tx.from("review").toComplete()
  )
};

const machine = createJourneyMachine(journey);

await machine.goToNextStep();
await machine.send({ type: "applyCoupon" });

console.log(machine.getSnapshot().currentStepId); // "review"
```

This is the key idea: instead of hiding flow logic inside many components, Journey keeps the map in one place.

## Framework Agnostic

`createJourneyMachine` is framework agnostic. It runs the journey runtime without any UI framework dependency.

Today we provide official bindings for React in `@rxova/journey-react`, but the same core machine can be connected to any other framework by reading snapshots and subscribing to machine updates.

## Snapshot At A Glance

The runtime snapshot is the single source of truth:

```ts
const snapshot = machine.getSnapshot();

const exampleSnapshot = {
  currentStepId: "details",
  history: {
    timeline: ["start", "details"],
    index: 1
  },
  context: { couponCode: null },
  visited: { start: true, details: true, review: false },
  stepMeta: { start: {}, details: {}, review: {} },
  status: "running",
  async: {
    isLoading: false,
    byStep: {
      start: { phase: "idle", eventType: null, transitionId: null, error: null },
      details: { phase: "idle", eventType: null, transitionId: null, error: null },
      review: { phase: "idle", eventType: null, transitionId: null, error: null }
    }
  }
};
```

`stepMeta`, `status`, and `async` are part of every Core snapshot (they are not optional fields).

`steps` are not part of the snapshot payload. This is intentional. Step definitions live in the journey config, while snapshot only contains runtime state. If you need the known step ids at runtime, they are reflected by keys in `visited`, `stepMeta`, and `async.byStep`.

Three invariants to keep in mind:

- `history.timeline.length >= 1`
- `0 <= history.index < history.timeline.length`
- `currentStepId === history.timeline[history.index]`

For full field-by-field meaning and examples, see [Core Snapshot](/docs/core/snapshot).

## TypeScript

Journey is TypeScript-first.

Step ids, events, payloads, context, and metadata can all be typed end-to-end, so invalid transitions and wrong payload shapes are caught at compile time.

For full typing patterns, see [Core TypeScript](/docs/core/typescript).

## Principles

- Model flows as graphs, not fixed lists.
- Keep runtime state in one snapshot.
- Declare transitions explicitly (`from`, `event`, `to`, `when`, `effect`).
- Keep core semantics independent from UI framework code.
- Keep runtime behavior deterministic (first valid transition wins).

## Core Model

A journey definition is small and stable:

- `steps`: where users can be
- `transitions`: how users move
- `context`: shared flow state
- `initial`: entry step

At runtime, the snapshot is the source of truth:

- `currentStepId`
- `history.timeline` + `history.index`
- `context`
- `visited`
- `stepMeta`
- `status`
- `async`

Reference details: [Core Snapshot](/docs/core/snapshot)

## Practical Advantages

- Faster debugging: one snapshot + lifecycle events explains what happened.
- Safer refactors: typed steps/events/payloads catch breakage early.
- Predictable navigation: timeline + pointer makes back/forward behavior reproducible.
- Clear async handling: `when`/`effect` phases are explicit and observable.
- Optional durability: persistence is versioned and migration-friendly.
