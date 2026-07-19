---
id: overview
title: React Overview
sidebar_label: Overview
---

`@rxova/journey-react` is the UI layer for `@rxova/journey-core`. It does not introduce another
state machine or translate snapshots into a legacy React-only shape. React components subscribe to
the same immutable snapshots and invoke the same command groups as any other Core consumer.

The package has three surfaces because ownership and authoring style differ across applications.

| Surface            | Import                          | Machine ownership                            | Best fit                               |
| ------------------ | ------------------------------- | -------------------------------------------- | -------------------------------------- |
| Declarative linear | `@rxova/journey-react`          | `<LinearJourney>` owns one machine per mount | Ordinary ordered wizards               |
| Graph bundle       | `@rxova/journey-react/graph`    | Each bundle Provider owns one machine        | Branching event-driven flows           |
| Headless hooks     | `@rxova/journey-react/headless` | The caller supplies a Core machine           | Existing machines and custom rendering |

## Declarative linear journeys

The linear component reads its direct step children once, builds a Core linear definition, starts the
machine, and renders the active child.

```tsx
import { LinearJourney, useLinearJourney } from "@rxova/journey-react";

type SignupContext = {
  email: string;
  acceptedTerms: boolean;
};

function SignupFooter() {
  const { machine, snapshot } = useLinearJourney<SignupContext>();

  return (
    <nav>
      <button
        disabled={!snapshot.history.canGoBack}
        onClick={() => void machine.navigate.goToPreviousStep()}
      >
        Back
      </button>
      <button
        disabled={snapshot.machine.isLoading}
        onClick={() => void machine.navigate.goToNextStep()}
      >
        Continue
      </button>
    </nav>
  );
}

export function Signup() {
  return (
    <LinearJourney
      context={{ email: "", acceptedTerms: false }}
      footer={<SignupFooter />}
      onComplete={({ snapshot }) => submitSignup(snapshot.context)}
    >
      <EmailStep id="email" />
      <TermsStep id="terms" />
      <ReviewStep id="review" />
    </LinearJourney>
  );
}
```

The child ID list is frozen for the mount. This matters because history, visit tracking, and index
derivations depend on a stable declared order. If steps need to branch dynamically, represent that
choice in a graph instead of changing the JSX list after mount.

`useLinearJourney()` returns `{ machine, snapshot }` — the underlying Core machine and its live
snapshot, verbatim. There is no renamed React-side shape:

- reads come from the snapshot: `snapshot.currentStep.id/.index/.isFirstStep/.isLastStep/` (the linear tier autostarts, so `currentStep` is never null)
  `.isFirstTimeVisit/.metadata/.async`, `snapshot.steps`, `snapshot.history`, `snapshot.status`,
  `snapshot.machine`, and `snapshot.context`;
- commands come from the machine groups: `machine.navigate.*` (including linear
  `goToStepByIndex`), `machine.controls.*`, `machine.context.update`, and
  `machine.async.clearError`.

### Typed linear bundles

A typed bundle binds context and a literal step-ID tuple once:

```ts
import { createLinearJourney } from "@rxova/journey-react";

const signup = createLinearJourney<SignupContext>()(["email", "terms", "review"] as const);
```

Use `signup.LinearJourney` instead of the untyped component, and use
`signup.useLinearJourney()`, `signup.useLinearJourneySelector()`, and
`signup.useLinearJourneyStep()` below it. The bundle is a type-level declaration; it does not
create a machine until the component mounts.

## Graph journey bundles

Graph definitions stay in Core. The React graph factory captures a definition and returns a bundle
of Provider, renderer, and namespaced hooks:

```tsx
import { createGraphJourney } from "@rxova/journey-react/graph";
import { checkoutDefinition } from "./checkout-definition";

const checkout = createGraphJourney(checkoutDefinition, {
  plugins: [createReplayPlugin()] as const
});

const views = {
  cart: CartStep,
  shipping: ShippingStep,
  payment: PaymentStep,
  done: DoneStep
};

function CheckoutControls() {
  const snapshot = checkout.useSnapshot();
  const api = checkout.useApi();

  const canContinue = snapshot.availableEvents.includes("continue");

  return (
    <button
      disabled={!canContinue || snapshot.machine.isLoading}
      onClick={() => void api.send("continue")}
    >
      Continue
    </button>
  );
}

export function Checkout() {
  return (
    <checkout.Provider views={views}>
      <checkout.StepRenderer fallback={<p>No view for this step.</p>} />
      <CheckoutControls />
    </checkout.Provider>
  );
}
```

No machine is created at module scope. Each Provider mount owns an independent machine with its own
context, history, plugin instances, subscriptions, and lifecycle. It starts automatically by default
and is disposed when the Provider unmounts. This makes rendering the same bundle twice safe.

Graph bundle hooks are:

- `useSnapshot()` for the full typed graph snapshot;
- `useSelector(selector, equalityFn?)` for a narrow subscription;
- `useApi()` for `controls`, `navigate`, typed `send`, and `updateContext`;
- `useStepAsyncState(stepId)` for entry async state;
- `useEvent(event, listener)` for exact Core observation payloads;
- `useStepLifecycle(stepId, callbacks)` for step-specific enter/leave observation;
- `useMachine()` for integration code that needs the owned machine.

All graph bundle hooks must run under that bundle's Provider. A hook from one bundle cannot consume a
different bundle's Provider.

### Per-mount configuration

The Provider accepts a shallow context override, `autoStart`, startup error handling, and a
`machineRef`:

```tsx
<checkout.Provider
  views={views}
  context={{ cartId: props.cartId }}
  autoStart
  onError={(error, { phase }) => report(error, phase)}
  machineRef={setMachine}
>
  <checkout.StepRenderer />
</checkout.Provider>
```

Use `machineRef` as an integration escape hatch, not as component state. Ordinary rendering should
stay on bundle hooks so React receives snapshot updates correctly.

## Headless machine-argument hooks

Headless hooks are useful when a Core machine is created by a router, service, test harness, or
higher application layer:

```tsx
import {
  useJourneyEvent,
  useJourneySelector,
  useJourneySnapshot,
  useStepAsyncState
} from "@rxova/journey-react/headless";

function MachinePanel({ machine }) {
  const snapshot = useJourneySnapshot(machine);
  const canGoBack = useJourneySelector(machine, (value) => value.history.canGoBack);
  const asyncState = useStepAsyncState(machine, "review");

  useJourneyEvent(machine, "navigationBlocked", ({ reason, error }) => {
    reportNavigationFailure(reason, error);
  });

  return (
    <section>
      <h2>{snapshot.currentStep?.id ?? "Not started"}</h2>
      <button disabled={!canGoBack} onClick={() => void machine.navigate.goToPreviousStep()}>
        Back
      </button>
      {asyncState.isError && <ErrorNotice error={asyncState.error} />}
    </section>
  );
}
```

Every headless hook takes the machine as its first argument. There is no hidden global runtime and no
Provider lookup. `useOwnedJourney(factory)` is available when a component should create and dispose
an arbitrary Core machine without using either Journey component surface.

## Snapshot and command semantics

React reads the current Core snapshot:

```ts
snapshot.status;
snapshot.context;
snapshot.currentStep.id; // non-null in the linear tier (autostart); nullable on bare core machines
snapshot.currentStep.metadata;
snapshot.currentStep.async;
snapshot.history.timeline;
snapshot.history.currentIndex;
snapshot.transition;
snapshot.machine.isLoading;
snapshot.machine.outcome;
```

Graph snapshots additionally expose `declaredEvents`, `availableEvents`, `availableSteps`, and
`outgoingTransitions`. Linear snapshots expose declared-order `steps` data and index flags on the
current step.

Core commands remain grouped. Lifecycle changes use `controls`; positional navigation uses
`navigate`; graph domain events use `send`; context writes use a functional updater. This
distinction prevents a button named “complete” from accidentally being treated as “move to the next
screen.”

## Where to continue

- [Quickstart](./quickstart) builds one example with each surface.
- [Provider and Hooks](./provider-and-hooks) documents ownership and hook contracts.
- [Async UI](./async-ui) explains pre-commit work and post-commit lifecycle effects.
- [TypeScript](./typescript) lists the current React exports.
- [DevTools](./devtools) shows the `machineRef` attachment pattern.
