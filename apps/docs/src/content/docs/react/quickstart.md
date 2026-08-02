---
title: "Quickstart"
---

Choose the React surface based on how the flow is authored and who should own the machine.

- Start with `createLinearJourney()` for an ordered flow.
- Use the graph bundle for named events, branches, and guards.
- Bring your own Core machine and `useSyncExternalStore` when a bundle's shared machine does not
  fit.

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
  const email = signup.useSelector((snapshot) => snapshot.context.email);

  return (
    <label>
      Email
      <input
        value={email}
        onChange={(event) =>
          signup.updateContext((current) => ({
            ...current,
            email: event.target.value
          }))
        }
      />
    </label>
  );
}

function ReviewStep() {
  signup.useStepHandler<{ accountId: string }>("review", {
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
  const canGoBack = signup.useSelector((snapshot) => snapshot.history.canGoBack);
  const isLoading = signup.useSelector((snapshot) => snapshot.machine.isLoading);

  const next = async () => {
    const result = await signup.navigate.goToNextStep();
    if (!result.ok && result.reason === "error") {
      report(result.error);
    }
  };

  return (
    <nav>
      <button disabled={!canGoBack} onClick={() => void signup.navigate.goToPreviousStep()}>
        Back
      </button>
      <button disabled={isLoading} onClick={() => void next()}>
        {isLoading ? "Working…" : "Continue"}
      </button>
    </nav>
  );
}

function CompletionLogger() {
  signup.useSubscribeEvent("statusChange", ({ current, snapshot }) => {
    if (current === "completed") {
      console.log(snapshot.context.accountId);
    }
  });
  return null;
}

export function Signup() {
  return (
    <signup.Provider
      views={{
        email: <EmailStep />,
        review: <ReviewStep />,
        success: <SuccessStep />
      }}
    >
      <CompletionLogger />
      <signup.StepRenderer />
      <Footer />
    </signup.Provider>
  );
}
```

The factory creates **one standalone machine** right there at module scope; it starts when this
Provider mounts (`autoStart` is three-way — see
[Bundle options](./overview.md#bundle-options)). Every bundle hook closes over that machine and works with or
without the Provider; non-React code drives the same machine via `signup.machine`,
`signup.navigate`, and `signup.updateContext(...)`. The Provider only hands `views` to
`<signup.StepRenderer />`—the one piece that must render inside it—so the footer and logger above
are ordinary siblings.

`useStepHandler("review", handler)` gates forward navigation while its component is mounted:
`run` executes before movement, a throw or rejection cancels `goToNextStep()` and lands in
`snapshot.currentStep.async.error`, and `commit`'s context update becomes visible in the same
snapshot that moves to Success. On the final step the handler never runs—`goToNextStep()` returns
out-of-bounds first. Reaching Success alone does not complete the machine—call
`signup.machine.controls.complete()` when the product outcome is complete.

## Step IDs are compile-time by default

There is no separate typed variant. `TContext` is inferred from `definition.context` (annotate the
value, as `initialContext` is above—do not cast), and the step-ID union is inferred from the
`steps` tuple, so no call site passes generics. The `views` record is keyed by that union and
checked exhaustively at compile time: a missing key or an undeclared key is a TS error. There is
no runtime assertion—for plain-JS callers a missing key simply makes `StepRenderer` render its
`fallback`. A `null` view value is legal and renders nothing.

Runtime configuration lives in the factory's second argument, frozen per bundle:

```ts
const signup = createLinearJourney(definition, { startAt: "review", autoStart: false });
```

With `autoStart: false` the journey is idle (`snapshot.currentStep` is `null`, `StepRenderer`
shows its `fallback`) until `signup.machine.controls.start()`. Step configuration (`metadata`,
`onEnter`, `onLeave`) lives in the definition's step objects, never in JSX—the `views` values only
supply what each step renders.

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

The two bundles are deliberate twins: one standalone machine created in the factory, a `views`
Provider, a `StepRenderer`, and the same reactive and stable hooks—linear speaks `navigate` where
graph speaks `send`. In both, state survives remounts and reset is explicit
(`machine.controls.restart()` from a terminal status).

## Bring your own machine

When you need a machine per mount or per request—or an integration a bundle does not cover—create
a Core machine yourself and read it with React's own `useSyncExternalStore`. No React package
entry is involved:

```tsx
import React from "react";
import { createLinearJourney } from "@rxova/journey-core";

const machine = createLinearJourney(
  { context: initialContext, steps: ["email", "review", "success"] },
  { autoStart: true }
);

const subscribe = (onStoreChange: () => void) =>
  machine.subscriptions.subscribeSelector((snapshot) => snapshot, onStoreChange);

function MachineStatus() {
  const snapshot = React.useSyncExternalStore(subscribe, machine.getSnapshot, machine.getSnapshot);

  React.useEffect(
    () =>
      machine.subscriptions.subscribeEvent("statusChange", ({ previous, current }) => {
        console.log(previous, current);
      }),
    []
  );

  return (
    <p>
      {snapshot.status}: {snapshot.currentStep?.id ?? "not started"}
    </p>
  );
}
```

The layer that created the machine keeps lifecycle ownership. `@rxova/journey-react` exports
structural types for writing such adapters generically: `AnyJourneyMachine`, `SnapshotOf`,
`ContextOf`, `StepIdOf`, and `EventPayloadOf`.
