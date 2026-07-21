---
id: overview
title: React Overview
sidebar_label: Overview
---

`@rxova/journey-react` is the UI layer for `@rxova/journey-core`. It does not introduce another
state machine or translate snapshots into a legacy React-only shape. React components subscribe to
the same immutable snapshots and invoke the same command groups as any other Core consumer.

The package has three surfaces because ownership and authoring style differ across applications.

| Surface        | Import                          | Machine ownership                     | Best fit                               |
| -------------- | ------------------------------- | ------------------------------------- | -------------------------------------- |
| Linear bundle  | `@rxova/journey-react`          | Each bundle Provider owns one machine | Ordinary ordered wizards               |
| Graph bundle   | `@rxova/journey-react/graph`    | Each bundle Provider owns one machine | Branching event-driven flows           |
| Headless hooks | `@rxova/journey-react/headless` | The caller supplies a Core machine    | Existing machines and custom rendering |

The linear and graph tiers share one factory shape: capture a definition once, get a bundle of
Provider and typed hooks back, and let each Provider mount own one machine.

## Linear journey bundles

`createLinearJourney()` captures a definition—core's own `LinearJourneyDefinition` shape—and
returns a bundle. The Provider builds a machine from that definition at mount, starts it, and
renders the active step's view from its `views` record.

```tsx
import { createLinearJourney } from "@rxova/journey-react";

type SignupContext = {
  email: string;
  acceptedTerms: boolean;
};

const initialContext: SignupContext = {
  email: "",
  acceptedTerms: false
};

const signup = createLinearJourney({
  name: "signup",
  context: initialContext,
  steps: ["email", "terms", "review"]
});

function SignupFooter() {
  const { machine, snapshot } = signup.useJourney();

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
    <signup.Provider
      views={{
        email: <EmailStep />,
        terms: <TermsStep />,
        review: <ReviewStep />
      }}
      footer={<SignupFooter />}
      onComplete={({ snapshot }) => submitSignup(snapshot.context)}
    />
  );
}
```

The definition is the single source of truth. `context` is both the initial value and the type
anchor—annotate the value (`const initialContext: SignupContext = { ... }`) rather than casting—so
`TContext` and the step-ID union are inferred and no call site passes generics. A bare string in
`steps` is shorthand for `{ id }`; step configuration (`metadata`, `onEnter`, `onLeave`) lives in
those step objects, never in JSX. The optional `name` becomes the Provider's React DevTools
displayName. History, visit tracking, and index derivations all follow the definition's declared
order.

The `views` record (`LinearJourneyViews<TStepId>`) only supplies what each step renders, keyed by
step ID; the definition alone drives order. Exhaustiveness is checked at compile time—a missing
key or an undeclared key is a TS error—and plain-JS callers get a runtime error for a missing key
plus a dev-mode warning for undeclared keys. A `null` view value is legal and renders nothing, and
because values are elements rather than component types, props and wrappers stay inline. If steps
need to branch dynamically, represent that choice in a graph instead.

`signup.useJourney()` returns `{ machine, snapshot }` — the underlying Core machine and its live
snapshot, verbatim. There is no renamed React-side shape:

- reads come from the snapshot: `snapshot.currentStep.id/.index/.isFirstStep/.isLastStep/` (the linear tier autostarts, so `currentStep` is never null)
  `.isFirstTimeVisit/.metadata/.async`, `snapshot.steps`, `snapshot.history`, `snapshot.status`,
  `snapshot.machine`, and `snapshot.context`;
- commands come from the machine groups: `machine.navigate.*` (including linear
  `goToStepByIndex`), `machine.controls.*`, `machine.context.update`, and
  `machine.async.clearError`.

`signup.useSelector(selector, equalityFn?)` subscribes to a derived slice, and
`signup.useStep(handler)` registers transactional forward-navigation work for the step component
calling it. Each bundle owns a private React context, so its hooks only work under its own
Provider.

### Bundle options and per-mount overrides

The factory's second argument passes Core's creation options through verbatim, frozen per bundle:
`persist`, `plugins`, `autoStart`, `startAt`, `defaultTimeoutMs`, and `onListenerError`.

```ts
const signup = createLinearJourney(
  { context: initialContext, steps: ["email", "terms", "review"] },
  { persist: sessionPersist, startAt: "email" }
);
```

Per-mount variation goes on the Provider instead, read once at mount: `initialContext` overrides
the definition's context value (route params, server data—the definition stays the type anchor; it
is a whole-object replacement, not a merge, so spread the definition's context yourself for a
partial override), and `startAt` overrides the starting step and wins over the bundle options'
`startAt`. Besides `views`, the Provider also takes `header`, `footer`, `wrapper`, `fallback`, the
`onStart` / `onStepEnter` / `onStepLeave` / `onComplete` / `onError` callbacks, and a `machineRef`
escape hatch.

No machine is created in the factory; one machine is created per Provider mount
(StrictMode-safe, disposed on unmount), and multiple Providers of one bundle are independent
instances. When a journey outgrows the linear tier, hand the same definition object to
`linearToGraphDefinition()` from `@rxova/journey-core/convert`.

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
an arbitrary Core machine without using either Journey factory surface.

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
