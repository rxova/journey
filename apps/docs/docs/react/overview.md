---
id: overview
title: React Overview
sidebar_label: Overview
---

`@rxova/journey-react` is the UI layer for `@rxova/journey-core`. It does not introduce another
state machine or translate snapshots into a legacy React-only shape. React components subscribe to
the same immutable snapshots and invoke the same command groups as any other Core consumer.

The package has two bundle tiers, plus a pattern for machines you own yourself.

| Surface        | Import                       | Machine ownership                       | Best fit                                  |
| -------------- | ---------------------------- | --------------------------------------- | ----------------------------------------- |
| Linear bundle  | `@rxova/journey-react`       | The factory owns one standalone machine | Ordinary ordered wizards                  |
| Graph bundle   | `@rxova/journey-react/graph` | The factory owns one standalone machine | Branching event-driven flows              |
| Bring your own | (pattern, no package entry)  | The caller supplies a Core machine      | Per-mount/per-request isolation, plumbing |

The two bundles are deliberate twins: one standalone machine created in the factory, a typed
`views` record on the Provider, a `StepRenderer`, and the same reactive and stable hooks. They
differ only in their verbs—linear speaks `navigate`, graph speaks `send`.

## Linear journey bundles

`createLinearJourney()` captures a definition—core's own `LinearJourneyDefinition` shape—and
creates **one standalone machine** right in the factory. The bundle wraps that machine with a
Provider, a renderer, and hooks:

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
  const canGoBack = signup.useSelector((snapshot) => snapshot.history.canGoBack);
  const isLoading = signup.useSelector((snapshot) => snapshot.machine.isLoading);

  return (
    <nav>
      <button disabled={!canGoBack} onClick={() => void signup.navigate.goToPreviousStep()}>
        Back
      </button>
      <button disabled={isLoading} onClick={() => void signup.navigate.goToNextStep()}>
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
    >
      <signup.StepRenderer />
      <SignupFooter />
    </signup.Provider>
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

The machine outlives any component: every hook closes over it and works with or without the
Provider, and non-React code drives the same machine via `signup.machine`, `signup.navigate`, and
`signup.updateContext(...)` (verbatim delegates). The Provider carries only `views` and
`children`; `<signup.StepRenderer />` is the only piece that must render inside it, and its
placement is the point—headers, footers, and observers are ordinary siblings around it.

The `views` record (`JourneyViews<TStepId>`) only supplies what each step renders, keyed by
step ID; the definition alone drives order. Exhaustiveness is checked at compile time—a missing
key or an undeclared key is a TS error. There is no runtime assertion: for plain-JS callers a
missing key makes `StepRenderer` render its `fallback`. A `null` view value is legal and renders
nothing, and because values are elements rather than component types, props and wrappers stay
inline. If steps need to branch dynamically, represent that choice in a graph instead.

Linear bundle hooks are:

- reactive: `useSnapshot()` for the machine's live snapshot; `useSelector(selector, equalityFn?)`
  for a narrow subscription; `useStep()` for the whole current step—ID, index flags, metadata,
  async state—or `null` while idle; `useContext()` for the context value;
  `useSubscribeEvent(event, listener)` for exact Core observation payloads;
- stable accessors: `useMachine()`, `useControls()`, and `useNavigation()` for the machine and its
  command groups, verbatim;
- `useStepHandler(stepId, handler)`: registers forward-navigation work for `stepId` while the
  calling component is mounted. `run` gates `goToNextStep()`, a throw or rejection cancels the
  move and lands in `currentStep.async.error`, and `commit` stages its context update
  transactionally with the movement.

None of them needs a Provider; each bundle's hooks always read that bundle's machine. Reads come
from the snapshot (`snapshot.currentStep`, `snapshot.steps`, `snapshot.history`,
`snapshot.status`, `snapshot.machine`, `snapshot.context`); commands come from the machine groups
(`machine.navigate.*` including linear `goToStepByIndex`, `machine.controls.*`,
`machine.context.update`, `machine.async.clearError`).

### Bundle options

The factory's second argument passes Core's creation options through verbatim, frozen per bundle:
`persist`, `plugins`, `autoStart`, `startAt`, `defaultTimeoutMs`, and `onListenerError`.

`autoStart` is three-way in this tier:

- **omitted (the default)** — the machine starts from a layout effect when the first Provider,
  reactive hook, `useSubscribeEvent`, or `useStepHandler` mounts. `controls.start()` is
  idempotent, so mounting many components still starts it exactly once. This ordering is what
  makes the journey's first `stepEnter` observable, and it keeps SSR deterministic: layout effects
  do not run on the server, so both sides render `fallback` and hydration matches.
- **`true`** — the machine starts eagerly inside the factory. Use it when the server must render
  step content, or when the bundle is driven entirely from non-React code (nothing ever mounts to
  start it).
- **`false`** — nothing starts until you call `signup.machine.controls.start()`. The machine is
  idle meanwhile: `snapshot.currentStep` is `null` and `StepRenderer` shows its `fallback`.

```ts
const signup = createLinearJourney(
  { name: "signup", context: initialContext, steps: ["email", "terms", "review"] },
  { persist: sessionPersist, startAt: "email" }
);
```

When a journey outgrows the linear tier, hand the same definition object to
`linearToGraphDefinition()` from `@rxova/journey-core/convert`.

## Graph journey bundles

Graph definitions stay in Core. The React graph factory captures a definition, creates its
standalone machine, and returns the same bundle shape with graph verbs:

```tsx
import { createGraphJourney } from "@rxova/journey-react/graph";
import { checkoutDefinition } from "./checkout-definition";

const checkout = createGraphJourney(checkoutDefinition, {
  plugins: [createReplayPlugin()] as const
});

function CheckoutControls() {
  const canContinue = checkout.useSelector((snapshot) =>
    snapshot.availableEvents.includes("continue")
  );
  const isLoading = checkout.useSelector((snapshot) => snapshot.machine.isLoading);

  return (
    <button disabled={!canContinue || isLoading} onClick={() => void checkout.send("continue")}>
      Continue
    </button>
  );
}

export function Checkout() {
  return (
    <checkout.Provider
      views={{
        cart: <CartStep />,
        shipping: <ShippingStep />,
        payment: <PaymentStep />,
        done: <DoneStep />
      }}
    >
      <ProgressHeader />
      <checkout.StepRenderer fallback={<p>No view for this step.</p>} />
      <CheckoutControls />
    </checkout.Provider>
  );
}
```

The graph bundle mirrors the linear one—`machine`, Provider with `views` and `children` only,
`StepRenderer`, reactive `useSnapshot` / `useSelector` / `useStep` / `useContext` /
`useSubscribeEvent`, stable `useMachine` / `useControls` / `useNavigation`—with the verbatim
delegates being `checkout.send(...)` and `checkout.updateContext(...)`. `views` (`JourneyViews`)
follows the same contract as the linear tier: keyed by step ID, exhaustively type-checked, element
values. None of the hooks needs a Provider.

## One machine per bundle, explicit resets

Both factories create their machine at module scope, and it starts when the bundle's first
Provider or hook mounts. The consequences are identical across tiers:

- All Providers and hooks of a bundle share the one machine, so rendering the same bundle twice
  shows the same journey.
- State survives remounts—unmounting disposes nothing.
- Reset is explicit: call `machine.controls.restart()` from a terminal status (`terminate()` first
  when mid-flight).
- In SSR a module-scope machine is shared across requests.

When you need per-mount or per-request isolation, either own the bundle with
[`useJourney()`](./patterns.md#own-a-bundle-inside-a-component) — which runs the factory once per
component instance and disposes the machine on a real unmount — or own a Core machine yourself and
read it with `useSyncExternalStore`, the next section.

## Bring your own machine

There is no separate headless package entry: a caller-owned Core machine needs nothing beyond
React's own `useSyncExternalStore`. Create the machine wherever it belongs—a router, service,
test harness, or request scope—and bridge it in a few lines:

```tsx
import React from "react";
import { createLinearJourney } from "@rxova/journey-core";

export const machine = createLinearJourney(
  { context: initialContext, steps: ["email", "review"] },
  { autoStart: true }
);

// The machine is a module-scope singleton, so the subscribe adapter is a
// stable plain function — useSyncExternalStore never resubscribes on it.
const subscribe = (onStoreChange: () => void) =>
  machine.subscriptions.subscribeSelector((snapshot) => snapshot, onStoreChange);

export const useJourneySnapshot = () =>
  React.useSyncExternalStore(subscribe, machine.getSnapshot, machine.getSnapshot);

function MachinePanel() {
  const snapshot = useJourneySnapshot();

  React.useEffect(
    () =>
      machine.subscriptions.subscribeEvent("navigationBlocked", ({ reason, error }) => {
        reportNavigationFailure(reason, error);
      }),
    []
  );

  return (
    <section>
      <h2>{snapshot.currentStep?.id ?? "Not started"}</h2>
      <button
        disabled={!snapshot.history.canGoBack}
        onClick={() => void machine.navigate.goToPreviousStep()}
      >
        Back
      </button>
    </section>
  );
}
```

The layer that created the machine keeps lifecycle ownership. For writing such adapters
generically, `@rxova/journey-react` exports structural types: `AnyJourneyMachine`, `SnapshotOf`,
`ContextOf`, `StepIdOf`, and `EventPayloadOf`.

## Snapshot and command semantics

React reads the current Core snapshot:

```ts
snapshot.status;
snapshot.context;
snapshot.currentStep?.id; // null while idle (before start); both bundles autostart by default
snapshot.currentStep?.metadata;
snapshot.currentStep?.async;
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
- [DevTools](./devtools) shows how to attach devtools to a bundle's `machine`.
