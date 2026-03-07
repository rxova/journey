# @rxova/journey-core

Headless runtime for non-linear journeys.

## Install

```bash
pnpm add @rxova/journey-core
yarn add @rxova/journey-core
npm i @rxova/journey-core
bun add @rxova/journey-core
```

Runs in Bun-based SPAs and other standard ESM runtimes.

## What You Get

- Deterministic transition matching (first match wins).
- Timeline + pointer navigation model (`history.timeline` + `history.index`).
- Built-in navigation and terminal events:
  `goToNextStep()`, `goToPreviousStep()`, `goToLastVisitedStep()`, `completeJourney()`, `terminateJourney()`.
- Async guard/effect lifecycle state in `snapshot.async`.
- Typed observability stream via `subscribeEvent`.
- Step metadata updates via `updateStepMetadata`.
- Optional persistence with schema versioning and migration hooks.

## Quickstart

```ts
import { createJourneyMachine } from "@rxova/journey-core";

type StepId = "start" | "review";
type Event = "goToNextStep" | "completeJourney" | "back";
type Ctx = { name: string };

const journey = {
  initial: "start",
  context: { name: "" },
  steps: {
    start: { meta: { label: "Start" } },
    review: { meta: { label: "Review" } }
  },
  transitions: [
    { from: "start", event: "goToNextStep", to: "review" },
    { from: "review", event: "completeJourney" }
  ]
};

const machine = createJourneyMachine<Ctx, StepId, Event>(journey);
await machine.goToNextStep();
await machine.goToPreviousStep();
await machine.completeJourney();

const snapshot = machine.getSnapshot();
console.log(snapshot.history.timeline, snapshot.history.index, snapshot.currentStepId);
```

## Behavioral Guarantees

- Transition selection is ordered: the first matching transition wins.
- `send({ type: "back" })` falls back to previous-step navigation when no explicit `back` transition exists.
- Once status is `complete` or `terminated`, pointer navigation and transitions no-op until `resetMachine()`.
- Forward navigation after moving back truncates timeline tail before appending the next step.
- Snapshot shape is stable: `currentStepId === history.timeline[history.index]`.

## Async Lifecycle

When guards/effects are async, step async state is tracked in `snapshot.async.byStep[stepId]`:

- `evaluating-when`: async guard in progress
- `running-effect`: async effect in progress
- `error`: guard/effect rejected
- `idle`: no active async work

`clearStepError(stepId?)` resets a step from `error` to `idle`.

`updateContext()` updates the current snapshot immediately, but it does not rebase an async transition that is already running. Async guards and effects keep the context they started with, and a running effect can later commit over a newer `updateContext()` call. If a context change must affect a transition, apply it before `send(...)` or wait for the transition promise to settle.

## Persistence

Persistence is optional and disabled automatically if storage is unavailable.

```ts
const machine = createJourneyMachine(journey, {
  persistence: {
    key: "checkout:journey",
    version: 2,
    clearOnReset: false,
    migrate: (legacySnapshot, persistedVersion) => {
      if (persistedVersion < 2) {
        return {
          currentStepId: "start",
          history: { timeline: ["start"], index: 0 },
          context: { name: "" },
          status: "running",
          visited: { start: true, review: false },
          stepMeta: { start: undefined, review: undefined }
        };
      }
      return legacySnapshot as never;
    },
    onError: (error) => {
      console.error("Persistence error", error);
    }
  }
});
```

Hydration coercion is defensive: malformed timeline/index/visited/status values fall back to safe defaults.

## Observability

Use `subscribeEvent` to inspect transition and navigation lifecycle events:

- `journey.start`
- `transition.start`
- `transition.success`
- `transition.error`
- `step.exit`
- `step.enter`
- `navigation.previous`
- `navigation.lastVisited`
- `journey.complete`
- `journey.close`
- `metadata.updated`

Use `subscribeStart(...)`, `subscribeComplete(...)`, and `subscribeTerminate(...)` when you only care about a specific lifecycle event.

`journey.start` is delivered immediately to each `subscribeEvent(...)` listener with the machine's startup step and startup timestamp.

## Transition Ergonomics

```ts
import { createTransitions, tx } from "@rxova/journey-core";

const transitions = createTransitions(
  tx.from("start").on("goToNextStep").to("review"),
  tx
    .from("review")
    .on("goToNextStep")
    .choose(
      tx.when(({ context }) => context.canSubmit).to("done", { id: "review-submit" }),
      tx.otherwise().to("review", { id: "review-stay" })
    ),
  tx.from("review").toComplete()
);
```
