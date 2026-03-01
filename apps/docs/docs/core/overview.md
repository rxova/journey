# Overview

## Motivation

The pain point is this: when an app has many steps and choices, the flow logic gets messy very fast.

Some rules live in one component, other rules live somewhere else, and side effects happen in random places. Then the app can move to the wrong step, and it becomes hard to understand or fix.

Journey is made to solve that problem. Think of it like one clear map for your app: it keeps the step rules in one place, so the flow is easier to read, test, and debug.

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

Each step then calls helpers like `goToPreviousStep`, `goToNextStep`, and `goToStepById`.

That feels easy at first, but as rules grow, each step starts making its own decisions:

```tsx
const Step2 = () => {
  const { goToNextStep, goToStepById } = useWizard();

  const onNext = async () => {
    if (!formIsValid()) return;
    const isVip = await checkVip();

    if (isVip) return goToStepById("vipOffer");
    return goToNextStep();
  };

  return <button onClick={() => void onNext()}>Next</button>;
};
```

Now imagine many steps doing this. The flow rules are spread out, so it is hard to see the full map.

With Journey, you can write those rules in one declarative list using `tx()`:

```tsx
import React from "react";
import {
  createJourneyBindings,
  createTransitions,
  tx,
  type JourneyReactDefinition
} from "@rxova/journey-react";

type StepId = "details" | "payment" | "review";
type CustomEvent = "applyCoupon";
type Context = { isVip: boolean };

let bindings: ReturnType<typeof createJourneyBindings<Context, StepId, CustomEvent>>;

const Details = () => {
  const api = bindings.useJourneyApi();
  return <button onClick={() => void api.goToNextStep()}>Next</button>;
};

const Payment = () => {
  const api = bindings.useJourneyApi();
  return <button onClick={() => void api.send({ type: "applyCoupon" })}>Apply coupon</button>;
};

const Review = () => {
  const api = bindings.useJourneyApi();
  return <button onClick={() => void api.completeJourney()}>Finish</button>;
};

const journey: JourneyReactDefinition<Context, StepId, CustomEvent> = {
  initial: "details",
  context: { isVip: false },
  steps: {
    details: { component: Details },
    payment: { component: Payment },
    review: { component: Review }
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

bindings = createJourneyBindings(journey);

export const App = () => {
  const Provider = bindings.Provider;
  const StepRenderer = bindings.StepRenderer;

  return (
    <Provider>
      <StepRenderer />
    </Provider>
  );
};
```

This is the key idea: instead of hiding flow logic inside many components, Journey keeps the map in one place.

## Principles

### Think in maps, not lists

Regular wizards assume one straight line. Journey assumes real product flows, where users branch, return, and recover. You model the real map once, and the runtime follows it.

### Keep one source of truth

Current step, history, context, and status live together in one snapshot. Your UI and your business logic stop disagreeing about where the user is.

### Make transitions explicit

Step changes are declared as readable rules. Teams review them faster, reason about them better, and break less during refactors.

### Keep flow logic independent from UI details

Journey core owns behavior. React bindings make it ergonomic to use. You get flexibility in the UI without rewriting your flow model.

### Favor predictable behavior

Journey is built around deterministic matching and clear lifecycle states. Predictability is what makes product flows safe to evolve.

## Why This Feels Better

When flow logic is centralized, new engineers can understand it quickly.
When history is first-class, debugging gets easier.
When async transition state is visible, loading and error UX becomes consistent.

This is not just cleaner code. It is a better day-to-day developer experience.

## The Mental Model

A journey definition stays intentionally small:

- `steps`: where users can be.
- `transitions`: how users can move.
- `context`: shared decision data.
- `initial`: where the journey starts.

That small model scales surprisingly well. You can start simple, then add branching, guards, effects, and persistence as the product grows.

## Runtime Confidence

At runtime, Journey gives you a snapshot that describes exactly what is happening now: current step, history pointer, context, status, and async phase.

That snapshot is what makes behavior explainable. You can render from it, log it, test it, and trust it.

## History That Helps

Journey tracks the realized path and a pointer into that path. This means back and revisit behavior is not guesswork. It is deterministic and reproducible.

When issues happen in production, this model gives your team a clear story of how the user got there.

## Persistence Without Friction

Persistence is optional, versioned, and migration-friendly.

If your flow needs resume-later behavior, Journey supports it without forcing complexity on teams that do not need it yet.

## React Experience

In React, Journey feels native: create typed bindings once, render with `Provider` + `StepRenderer`, and use hooks where needed.

You keep the flow model centralized while still writing normal React components.

## Safe by Design

Journey keeps definitions stable at runtime. Step ids and structure stay fixed, while runtime state changes through explicit machine APIs.

This separation keeps your model clean, your behavior observable, and your app safer to evolve.

## Why Teams Adopt Journey

Teams adopt Journey when product flows stop being linear and start becoming real.

If your app has branching, async checks, retries, and recovery paths, Journey gives you a simpler mental model and a codebase that stays maintainable over time.
