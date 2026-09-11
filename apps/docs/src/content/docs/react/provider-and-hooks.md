---
title: "Provider and Hooks API"
---

This page focuses on React ownership and subscription behavior. Runtime navigation, lifecycle, and
snapshot semantics come directly from Core; see [Core API](../core/api/overview.md) and
[Lifecycle](../core/lifecycle.md).

## `createLinearJourney()`

`createLinearJourney(definition, options?)` captures Core's linear definition shape —
`{ context, steps }`, plus an optional `name` used for the Provider's React DevTools displayName —
and creates **one standalone machine** right in the factory, at module scope. It returns a bundle
around that machine: `machine`, `Provider`, `StepRenderer`, the reactive hooks `useSnapshot`,
`useSelector`, `useStep`, `useContext`, and `useSubscribeEvent`, the stable accessors
`useMachine`, `useControls`, and `useNavigation`, the forward gate `useStepHandler`, and the
verbatim delegates `navigate` and `updateContext` — each pre-bound to the definition's context and
step-id types. A bare string in `steps` is shorthand for `{ id }`; a config object also carries
Core's per-step config: `metadata` plus `onEnter`/`onLeave` hooks.

```tsx
import { createLinearJourney } from "@rxova/journey-react";

type CheckoutContext = {
  shipping: ShippingDetails | null;
  shippingId: string | null;
};

const initialContext: CheckoutContext = { shipping: null, shippingId: null };

const checkout = createLinearJourney({
  name: "checkout",
  context: initialContext,
  steps: ["account", { id: "shipping", metadata: { title: "Shipping" } }, "review"]
});
```

`TContext` is inferred from `definition.context` — annotate the value, as above, rather than
casting — and the step-id union is inferred from the `steps` tuple; call sites never pass
generics. See [TypeScript Types](./typescript.md) for the inference story.

Declared `metadata` surfaces at `snapshot.currentStep.metadata` while the step is current; there is
no separate per-step metadata lookup. Definition `onEnter`/`onLeave` hooks run in Core, outside
React — they cannot close over component state or props. Component-scoped async work belongs in
[`useStepHandler()`](#usestephandler).

The second argument is Core's runtime options, verbatim and frozen per bundle: `startAt`,
`persist`, `plugins`, `defaultTimeoutMs`, `onListenerError`, and `autoStart` — which is three-way
in this tier: omitted (the default) starts the machine when the bundle's first Provider or hook
mounts, `true` starts it eagerly inside the factory, and `false` waits for
`checkout.machine.controls.start()`. See [Bundle options](./overview.md#bundle-options). The `startAt` option starts the
journey directly at that step: earlier steps are never entered or visited, their
`onEnter`/`onLeave` hooks never fire, the timeline begins as `[startAt]`, and
`controls.restart()` returns to it. An unknown `startAt` id throws at creation.

The machine outlives any component: every hook closes over it and works with or without the
Provider, non-React code drives it via `checkout.machine`, `checkout.navigate`, and
`checkout.updateContext(...)`, and unmounting disposes nothing. The consequences are worth stating
plainly: all Providers and hooks share the one machine; journey state survives unmounts and
remounts, so reset explicitly — `controls.restart()` from a terminal status, `terminate()` first
when mid-flight; and under SSR a module-scope machine is shared across requests. For per-mount
or per-request isolation, own the bundle with `useJourney()`
(see [Own a bundle inside a component](./patterns.md#own-a-bundle-inside-a-component)), or own a
Core machine yourself and read it with `React.useSyncExternalStore`
(see [Caller-owned machines](#caller-owned-machines)).

## `<Provider>`, `views`, and `<StepRenderer>`

The Provider takes exactly two props — `views` and `children` — and exists to hand the views to
`<StepRenderer>`, the one piece that must render inside it. `views` maps each declared step id to
what that step renders; `StepRenderer` renders the active step's view wherever you place it, so
headers and footers are ordinary siblings. Step config lives in the definition, never in `views` —
a view supplies markup, nothing else.

```tsx
<checkout.Provider
  views={{
    account: <Account />,
    shipping: <Shipping />,
    review: <Review />
  }}
>
  <Progress />
  <checkout.StepRenderer fallback={<p>Starting…</p>} />
  <Controls />
</checkout.Provider>
```

`views` is typed as `JourneyViews<TStepId>` — `{ [K in TStepId]: ReactNode }` — so coverage
is checked entirely at compile time: a missing key and an undeclared key are both TS errors, and
there is no runtime assertion. A `null` view value is legal and renders nothing. `StepRenderer`
shows its optional `fallback` whenever no view can render: while the machine is idle
(`autoStart: false` before `start()`, when `currentStep` is `null`) or, in plain JS, when the
active id has no key. Values are elements, not component types, so props and wrappers stay inline.
The active view is keyed by its step id: every entry into a step mounts the view fresh, so local
component state does not survive leaving the step.

There are no other Provider props. Starting position and runtime configuration are factory
options, step config lives in the definition, and events are observed with `useSubscribeEvent` in
a component — or with `machine.subscriptions` at module scope, no React involved:

```ts
checkout.machine.subscriptions.subscribeEvent("statusChange", ({ current }) => {
  if (current === "completed") analytics.track("checkout completed");
});
```

## Reactive hooks: `useSnapshot()`, `useSelector()`, `useStep()`, `useContext()`, and `useSubscribeEvent()`

The reactive hooks subscribe to the bundle's machine directly — none of them needs a Provider
above it:

```tsx
function Controls() {
  const snapshot = checkout.useSnapshot();
  const navigate = checkout.useNavigation();

  const currentStep = snapshot.currentStep;
  if (currentStep === null) return null; // idle: autoStart: false, not started yet

  return (
    <nav>
      <p>
        {currentStep.id} ({currentStep.index + 1} / {snapshot.steps.totalSteps})
      </p>
      <button disabled={currentStep.isFirstStep} onClick={() => void navigate.goToPreviousStep()}>
        Back
      </button>
      <button disabled={snapshot.machine.isLoading} onClick={() => void navigate.goToNextStep()}>
        Continue
      </button>
    </nav>
  );
}
```

Every read is a snapshot field: `snapshot.currentStep.id/.index/.isFirstStep/.isLastStep/`
`.isFirstTimeVisit/.metadata/.async`, `snapshot.steps.totalSteps/.stepOrder`,
`snapshot.history.visited`, `snapshot.status`, `snapshot.machine.isLoading/.isPaused`, and
`snapshot.context`. `snapshot.currentStep` is `null` while the machine is idle — exactly as in
the graph tier. See [Snapshot](../core/snapshot.md) for the complete contract.

```tsx
const isLoading = checkout.useSelector((snapshot) => snapshot.machine.isLoading);
const step = checkout.useStep();
const context = checkout.useContext();

checkout.useSubscribeEvent("stepEnter", ({ from, to, direction }) =>
  analytics.track("step", { from, to, direction })
);
```

Prefer `useSelector` when a component needs only one changing value; the optional equality
function controls when React re-renders, and selectors should be pure and not mutate snapshot
data. `useStep()` returns the whole `currentStep` — id, metadata, async state — or `null` while
idle. `useContext()` returns the live context value.

`useSubscribeEvent` requires an exact Core subscription name and receives its exact payload; the
listener reference can change without forcing a new subscription, and the subscription lasts for
the component's lifetime. `stepEnter` carries `{ snapshot, from, to, direction }`, where
`direction` is `"forward" | "backward" | "jump"` by intent: only `goToNextStep` and
`goToPreviousStep` report `"forward"`/`"backward"`; the initial entry, `goToStepById`,
`goToStepByIndex`, and `goToLastVisitedStep` report `"jump"`. `stepLeave` carries
`{ snapshot, from, to }`, `statusChange` carries `{ snapshot, previous, current }`, and `error`
carries `{ snapshot, error, phase, stepId }`.

## Stable accessors and outside-React commands

```tsx
const machine = checkout.useMachine();
const controls = checkout.useControls();
const navigate = checkout.useNavigation();

controls.pause();
controls.resume();
await navigate.goToPreviousStep();
await checkout.navigate.goToNextStep();
checkout.updateContext((context) => ({ ...context, dirty: true }));
```

The accessors return the machine and its stable grouped methods without subscribing — they never
cause a re-render. Every command is a machine group: `machine.navigate.*` (including linear
`goToStepByIndex`), `machine.controls.*`, `machine.context.update(updater)`, and
`machine.async.clearError()`; navigation methods return Core `NavigationResult` values. `navigate`
and `updateContext` are also plain properties on the bundle — `machine.navigate` and
`machine.context.update`, verbatim — callable from React or anywhere else. Integrations attach to
the machine directly:

```tsx
React.useEffect(() => attachJourneyDevtools(checkout.machine, { mutationsEnabled: false }), []);
```

See [Machine API](../core/api/machine-api.md) for the complete contracts.

## `useStepHandler()`

A step component can register transactional work that must succeed before forward navigation. The
step id is explicit — the first argument, typed to the declared union:

```tsx
function ShippingStep() {
  checkout.useStepHandler("shipping", {
    run: ({ snapshot }) => shippingApi.save(snapshot.context.shipping),
    commit: ({ result, updateContext }) => {
      updateContext((context) => ({
        ...context,
        shippingId: result.id
      }));
    }
  });

  return <ShippingForm />;
}
```

The hook is a thin shell over Core's
`machine.navigate.registerNextStepInterceptor(stepId, work)`: the registration lasts while the
calling component is mounted (it unregisters on unmount), and
`machine.navigate.goToNextStep()` runs the work when no explicit work is passed. `run` happens
before movement; `commit` publishes its updates atomically with movement. A failed run leaves the
source step and context in place, and the error lands in `snapshot.currentStep.async.error` until
`machine.async.clearError()`; `snapshot.machine.isLoading` is `true` while the work is pending.
The gate is forward-only: timeline moves and `goToStepById` bypass it, and it never fires on the
final step (`goToNextStep` on the last step never auto-completes).

## Growing into the graph tier

The captured definition is Core's own `LinearJourneyDefinition` shape, so the same object converts
directly when an ordered flow grows into named graph events:

```ts
import { linearToGraphDefinition } from "@rxova/journey-core/convert";

const definition = {
  context: initialContext,
  steps: ["account", "shipping", "review"]
} as const;

const checkout = createLinearJourney(definition);
const graphDefinition = linearToGraphDefinition(definition);
```

## Graph bundle

`createGraphJourney(definition, options?)` returns the linear bundle's twin with graph verbs —
the same standalone machine created by the factory at module scope, `send` where linear has
`navigate` gating. Every hook closes over the machine and works with or without the Provider, and
non-React code drives it through `checkout.machine`, `checkout.send(...)`, and
`checkout.updateContext(...)` — verbatim delegates. `autoStart` behaves identically here: omitted
starts the machine on the first mount, `true` starts it in the factory, `false` waits for
`checkout.machine.controls.start()`.

```tsx
const checkout = createGraphJourney(checkoutDefinition);

<checkout.Provider
  views={{
    cart: <Cart />,
    shipping: <Shipping />,
    review: <Review />,
    done: <Done />
  }}
>
  <ProgressHeader />
  <checkout.StepRenderer fallback={<MissingStep />} />
  <Toolbar />
</checkout.Provider>;
```

The Provider exists only to hand `views` to `<StepRenderer>`, which is the one piece that must
render inside it. `views` is `JourneyViews<TStepId>` — `{ [K in TStepId]: ReactNode }`, the
same contract as the linear tier: exhaustively type-checked, element values so props and wrappers
stay inline. `StepRenderer` renders the active step's view wherever you place it (headers and
footers are ordinary siblings), keys it by step id so each entry mounts the view fresh, and shows
its optional `fallback` while the machine is idle.

The standalone-machine consequences match the linear tier: all Providers and hooks share the one
machine; journey state survives unmounts and remounts, so reset explicitly —
`controls.restart()` from a terminal status, `terminate()` first when mid-flight; and under SSR
the module-scope machine is shared across requests. For per-mount or per-request isolation, own a
Core machine yourself and read it with `React.useSyncExternalStore` (see
[Caller-owned machines](#caller-owned-machines)).

### Graph `useSnapshot()` and `useSelector()`

```tsx
const snapshot = checkout.useSnapshot();
const stepId = checkout.useSelector((value) => value.currentStep?.id);
```

Use the snapshot when several related values must be rendered together. Use a selector for leaf
components that should not re-render on unrelated context or plugin changes. Neither needs a
Provider above it — they subscribe to the bundle's machine directly.

### Graph `useStep()`, `useContext()`, and `useSubscribeEvent()`

```tsx
const step = checkout.useStep();
const context = checkout.useContext();

checkout.useSubscribeEvent("navigationBlocked", ({ reason, error }) => {
  report(reason, error);
});
```

`useStep()` returns the whole `currentStep` — id, metadata, async state — or `null` while the
machine is idle. `useContext()` returns the live context value. `useSubscribeEvent` requires an
exact Core subscription name and receives its exact payload; the listener reference can change
without forcing a new subscription, and the subscription lasts for the component's lifetime.

### Graph stable accessors and outside-React commands

```tsx
const machine = checkout.useMachine();
const controls = checkout.useControls();
const navigate = checkout.useNavigation();

controls.pause();
controls.resume();
await navigate.goToPreviousStep();
await navigate.goToLastVisitedStep();
await checkout.send("continue");
checkout.updateContext((context) => ({ ...context, dirty: true }));
```

The accessors return the machine and its stable grouped methods without subscribing — they never
cause a re-render. `send` is narrowed to the event union inferred from the definition, and both
`send` and `updateContext` are plain functions on the bundle, callable from React or anywhere
else. Integrations attach to `checkout.machine` directly — no Provider or ref involved.

## Caller-owned machines

Per-mount or per-request isolation, tests, and integrations that must own the machine's lifecycle
use a Core machine directly. There is no separate React hook package for this — React's own
`useSyncExternalStore` is the whole bridge:

```tsx
import React from "react";
import { createLinearJourney } from "@rxova/journey-core";

export const machine = createLinearJourney({ context: initialContext, steps }, { autoStart: true });

// The machine is a module-scope singleton, so this adapter is a stable plain
// function — useSyncExternalStore never resubscribes on it.
const subscribe = (onStoreChange: () => void) =>
  machine.subscriptions.subscribeSelector((snapshot) => snapshot, onStoreChange);

export const useJourneySnapshot = () =>
  React.useSyncExternalStore(subscribe, machine.getSnapshot, machine.getSnapshot);
```

`machine.getSnapshot` is a stable bound function, so it serves as both the client and server
getter unchanged. Observe events in an effect — `subscribeEvent` returns its unsubscribe:

```tsx
React.useEffect(
  () => machine.subscriptions.subscribeEvent("stepEnter", ({ from, to }) => console.log(from, to)),
  []
);
```

You own start and disposal: create the machine where its lifetime belongs (module, request, mount,
or test), and call `machine.dispose()` when that owner goes away. For typing wrappers around a
caller-owned machine, `@rxova/journey-react` exports the structural helpers `AnyJourneyMachine`,
`SnapshotOf`, `ContextOf`, `StepIdOf`, and `EventPayloadOf`. The `react-showcase-headless`
example is the canonical version of this pattern.
