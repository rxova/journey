---
title: Quickstart
sidebar_position: 2
---

Choose the React surface based on who owns the machine and how the flow is authored.

- Start with `createLinearJourney()` for an ordered flow.
- Use the graph bundle for named events, branches, and guards.
- Use headless hooks when a Core machine already exists.

## Build a linear signup

```tsx
import { createLinearJourney } from "@rxova/journey-react";

type SignupContext = {
  email: string;
  accountId: string | null;
};

const initialContext: SignupContext = {
  email: "",
  accountId: null
};

const signup = createLinearJourney({
  name: "signup",
  context: initialContext,
  steps: ["email", "review", "success"]
});

function EmailStep() {
  const { machine, snapshot } = signup.useJourney();

  return (
    <label>
      Email
      <input
        value={snapshot.context.email}
        onChange={(event) =>
          machine.context.update((current) => ({
            ...current,
            email: event.target.value
          }))
        }
      />
    </label>
  );
}

function ReviewStep() {
  signup.useStep<{ accountId: string }>({
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
  const { machine, snapshot } = signup.useJourney();

  const next = async () => {
    const result = await machine.navigate.goToNextStep();
    if (!result.ok && result.reason === "error") {
      report(result.error);
    }
  };

  const isLoading = snapshot.machine.isLoading;

  return (
    <nav>
      <button
        disabled={!snapshot.history.canGoBack}
        onClick={() => void machine.navigate.goToPreviousStep()}
      >
        Back
      </button>
      <button disabled={isLoading} onClick={() => void next()}>
        {isLoading ? "Working…" : "Continue"}
      </button>
    </nav>
  );
}

export function Signup() {
  return (
    <signup.Provider
      views={{
        email: <EmailStep />,
        review: <ReviewStep />,
        success: <SuccessStep />
      }}
      footer={<Footer />}
      onComplete={({ snapshot }) => console.log(snapshot.context.accountId)}
    />
  );
}
```

The factory captures the definition; each `<signup.Provider>` mount creates, starts, and disposes
its own Core machine. Navigation work on Review runs before movement; its context commit becomes
visible in the same snapshot that moves to Success. Reaching Success alone does not complete the
machine—call `machine.controls.complete()` when the product outcome is complete.

## Step IDs are compile-time by default

There is no separate typed variant. `TContext` is inferred from `definition.context` (annotate the
value, as `initialContext` is above—do not cast), and the step-ID union is inferred from the
`steps` tuple, so no call site passes generics. The `views` record is keyed by that union and
checked exhaustively at compile time: a missing key or an undeclared key is a TS error. Plain-JS
callers get a runtime error for a missing key and a dev-mode warning for undeclared keys. A `null`
view value is legal and renders nothing.

Per-mount data flows through Provider props, read once at mount. `initialContext` replaces the
definition's context wholesale (it is not merged), and `startAt` is typed to the ID union:

```tsx
<signup.Provider
  views={views}
  startAt="review"
  initialContext={{ email: user.email, accountId: null }}
/>
```

Step configuration (`metadata`, `onEnter`, `onLeave`) lives in the definition's step objects, never
in JSX—the `views` values only supply what each step renders.

## Build a graph checkout

Create the graph definition with Core, then bind it to React:

```tsx
import { createGraphJourney } from "@rxova/journey-react/graph";
import { checkoutDefinition } from "./checkout-definition";

const checkout = createGraphJourney(checkoutDefinition);

function GraphControls() {
  const navigate = checkout.useNavigation();
  const canGoBack = checkout.useSelector((snapshot) => snapshot.history.canGoBack);
  const canContinue = checkout.useSelector((snapshot) =>
    snapshot.availableEvents.includes("continue")
  );

  return (
    <nav>
      <button disabled={!canGoBack} onClick={() => void navigate.goToPreviousStep()}>
        Back
      </button>
      <button disabled={!canContinue} onClick={() => void checkout.send("continue")}>
        Continue
      </button>
    </nav>
  );
}

export function Checkout() {
  return (
    <checkout.Provider
      views={{
        cart: <Cart />,
        shipping: <Shipping />,
        payment: <Payment />,
        done: <Done />
      }}
    >
      <checkout.StepRenderer fallback={<p>Unknown step</p>} />
      <GraphControls />
    </checkout.Provider>
  );
}
```

Both tiers render from a typed `views` record, but ownership differs deliberately. The graph
factory creates **one standalone machine** right there at module scope: every bundle hook closes
over it and works with or without the Provider, and non-React code drives the same machine via
`checkout.machine`, `checkout.send(...)`, and `checkout.updateContext(...)`. The Provider only
hands `views` to `<checkout.StepRenderer />`, which is the one piece that must render inside it—
place it among ordinary siblings like headers and controls. Because the machine is standalone,
state survives remounts; reset is explicit via `checkout.machine.controls.restart()` from a
terminal status.

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
