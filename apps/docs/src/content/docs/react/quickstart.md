---
title: Quickstart
sidebar_position: 2
---

Choose the React surface based on who owns the machine and how the flow is authored.

- Start with `<LinearJourney>` for an ordered JSX flow.
- Use the graph bundle for named events, branches, and guards.
- Use headless hooks when a Core machine already exists.

## Build a linear signup

```tsx
import { LinearJourney, useLinearJourney, useLinearJourneyStep } from "@rxova/journey-react";

type SignupContext = {
  email: string;
  accountId: string | null;
};

function EmailStep() {
  const { context, updateContext } = useLinearJourney<SignupContext>();

  return (
    <label>
      Email
      <input
        value={context.email}
        onChange={(event) =>
          updateContext((current) => ({
            ...current,
            email: event.target.value
          }))
        }
      />
    </label>
  );
}

function ReviewStep() {
  useLinearJourneyStep<SignupContext, { accountId: string }>({
    run: ({ snapshot }) => signupApi.create(snapshot.context.email),
    commit: ({ result, updateContext }) => {
      updateContext((context) => ({
        ...context,
        accountId: result.accountId
      }));
    }
  });

  return <p>Review and create the account.</p>;
}

function Footer() {
  const journey = useLinearJourney<SignupContext>();

  const next = async () => {
    const result = await journey.goToNextStep();
    if (!result.ok && result.reason === "error") {
      report(result.error);
    }
  };

  return (
    <nav>
      <button
        disabled={!journey.snapshot.history.canGoBack}
        onClick={() => void journey.goToPreviousStep()}
      >
        Back
      </button>
      <button disabled={journey.isLoading} onClick={() => void next()}>
        {journey.isLoading ? "Working…" : "Continue"}
      </button>
    </nav>
  );
}

export function Signup() {
  return (
    <LinearJourney<SignupContext>
      context={{ email: "", accountId: null }}
      footer={<Footer />}
      onComplete={({ context }) => console.log(context.accountId)}
    >
      <EmailStep id="email" />
      <ReviewStep id="review" />
      <SuccessStep id="success" />
    </LinearJourney>
  );
}
```

The journey owns and starts the Core machine. Navigation work on Review runs before movement; its
context commit becomes visible in the same snapshot that moves to Success. Reaching Success alone
does not complete the machine—call `controls.complete()` when the product outcome is complete.

## Add compile-time step IDs

```ts
const signup = createLinearJourney<SignupContext>()(["email", "review", "success"] as const);
```

Replace `LinearJourney` with `signup.LinearJourney` and use the bundle hooks. At mount, the child
IDs are checked against the declared tuple.

## Build a graph checkout

Create the graph definition with Core, then bind it to React:

```tsx
import { createGraphJourney } from "@rxova/journey-react/graph";
import { checkoutDefinition } from "./checkout-definition";

const checkout = createGraphJourney(checkoutDefinition);

const views = {
  cart: Cart,
  shipping: Shipping,
  payment: Payment,
  done: Done
};

function GraphControls() {
  const snapshot = checkout.useSnapshot();
  const api = checkout.useApi();

  return (
    <nav>
      <button
        disabled={!snapshot.history.canGoBack}
        onClick={() => void api.navigate.goToPreviousStep()}
      >
        Back
      </button>
      <button
        disabled={!snapshot.availableEvents.includes("continue")}
        onClick={() => void api.send("continue")}
      >
        Continue
      </button>
    </nav>
  );
}

export function Checkout() {
  return (
    <checkout.Provider views={views}>
      <checkout.StepRenderer fallback={<p>Unknown step</p>} />
      <GraphControls />
    </checkout.Provider>
  );
}
```

The Provider creates one machine for this mount. A second Provider creates a separate machine; the
two do not share context or history.

## Render an existing machine

```tsx
import { useJourneyEvent, useJourneySnapshot } from "@rxova/journey-react/headless";

function MachineStatus({ machine }) {
  const snapshot = useJourneySnapshot(machine);

  useJourneyEvent(machine, "statusChange", ({ previous, current }) => {
    console.log(previous, current);
  });

  return (
    <p>
      {snapshot.status}: {snapshot.currentStep?.id ?? "not started"}
    </p>
  );
}
```

Headless hooks do not start or dispose the machine. The layer that created it keeps lifecycle
ownership.
