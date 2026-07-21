---
title: Provider and Hooks API
sidebar_position: 3
---

This page focuses on React ownership and subscription behavior. Runtime navigation, lifecycle, and
snapshot semantics come directly from Core; see [Core API](/docs/core/api) and
[Lifecycle](/docs/core/lifecycle).

## `createLinearJourney()`

`createLinearJourney(definition, options?)` captures Core's linear definition shape —
`{ context, steps }`, plus an optional `name` used for the Provider's React DevTools displayName —
and returns a typed bundle: `Provider`, `useJourney`, `useSelector`, and `useStep`, each pre-bound
to the definition's context and step-id types. A bare string in `steps` is shorthand for `{ id }`;
a config object also carries Core's per-step config: `metadata` plus `onEnter`/`onLeave` hooks.

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
generics. See [TypeScript Types](/docs/react/typescript) for the inference story.

Declared `metadata` surfaces at `snapshot.currentStep.metadata` while the step is current; there is
no separate per-step metadata lookup. Definition `onEnter`/`onLeave` hooks run in Core, outside
React — they cannot close over component state or props. Component-scoped async work belongs in
[`useStep()`](#usestep).

The second argument is Core's runtime options, verbatim and frozen per bundle: `startAt`,
`persist`, `plugins`, `defaultTimeoutMs`, `onListenerError`, and `autoStart` — which defaults to
`true` in React; with `autoStart: false` the Provider renders `fallback` until
`machine.controls.start()`.

The factory creates no machine. Each `<checkout.Provider>` mount creates its own machine and
disposes it on unmount, so multiple Providers are independent instances. Each bundle also owns a
private React context: its hooks only see its own Providers, and calling `checkout.useJourney()`
under another bundle's Provider throws.

## `<Provider>` and `views`

The Provider renders the flow from its `views` record: one entry per declared step id, mapping the
id to what that step renders. Only the active step's view is mounted. Step config lives in the
definition, never in `views` — a view supplies markup, nothing else.

```tsx
<checkout.Provider
  views={{
    account: <Account />,
    shipping: <Shipping />,
    review: <Review />
  }}
  header={<Progress />}
  footer={<Controls />}
  fallback={<p>Journey unavailable</p>}
  onStepEnter={({ from, to, direction }) => analytics.track("step", { from, to, direction })}
/>
```

`views` is typed as `LinearJourneyViews<TStepId>` — `{ [K in TStepId]: ReactNode }` — so
exhaustiveness is checked at compile time: a missing key and an undeclared key are both TS errors.
A runtime safety net remains for plain-JS callers: a missing key throws, an undeclared key is a
development-mode error (it can never render). A `null` view value is legal and renders nothing.
Values are elements, not component types, so props and wrappers stay inline. The active view is
keyed by its step id: every entry into a step mounts the view fresh, so local component state does
not survive leaving the step.

Important props include:

| Prop                          | Meaning                                                                                                                                                                |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `views`                       | One view per declared step id; only the active step's view renders                                                                                                     |
| `initialContext`              | Mount-time replacement of the definition's initial context (route params, server data) — a whole-object replacement, not a merge; the definition stays the type anchor |
| `startAt`                     | Mount-time override of the starting step, typed to the step-id union; wins over the factory options' `startAt`                                                         |
| `header` / `footer`           | Content rendered inside journey context                                                                                                                                |
| `wrapper`                     | Element cloned around the active step                                                                                                                                  |
| `fallback`                    | Content shown when no step can render                                                                                                                                  |
| `onStart`                     | Fires once per mount with the start snapshot                                                                                                                           |
| `onStepEnter` / `onStepLeave` | Verbatim Core `stepEnter` / `stepLeave` event payloads                                                                                                                 |
| `onComplete`                  | Core `statusChange` payload, forwarded when `current === "completed"`                                                                                                  |
| `onError`                     | Verbatim Core `error` event payload                                                                                                                                    |
| `machineRef`                  | Imperative access for integration code                                                                                                                                 |

Callback props are verbatim forwards of Core subscription events. `onStepEnter` receives
`{ snapshot, from, to, direction }`, where `direction` is `"forward" | "backward" | "jump"` by
intent: only `goToNextStep` and `goToPreviousStep` report `"forward"`/`"backward"`; the initial
entry, `goToStepById`, `goToStepByIndex`, and `goToLastVisitedStep` report `"jump"`.
`onStepLeave` receives `{ snapshot, from, to }`, `onComplete` receives
`{ snapshot, previous, current }`, and `onError` receives `{ snapshot, error, phase, stepId }`.

`startAt` — the prop or the factory option — starts the journey directly at that step: earlier
steps are never entered or visited, their `onEnter`/`onLeave` hooks never fire, the timeline
begins as `[startAt]`, and `controls.restart()` returns to it. An unknown `startAt` id throws at
mount.

**Render is pure.** The machine is created idle during render and started in a layout effect, so
step `onEnter` hooks and persistence writes never run inside a render. Until the start commits
(the first client frame, server rendering, or an `autoStart: false` bundle you have not started
yet) only `fallback` renders — hook consumers never observe a missing `currentStep`. On the client
the start re-renders synchronously before paint, so nothing flashes; on the server the emitted
HTML is the fallback. With `autoStart: false`, start the journey yourself via `machineRef` or
`useJourney().machine.controls.start()`.

## `useJourney()`

The bundle's `useJourney()` must run below that bundle's own Provider. It returns the underlying
Core machine and its live snapshot, verbatim — there is no React-only convenience shape:

```tsx
function Controls() {
  const { machine, snapshot } = checkout.useJourney();

  const currentStep = snapshot.currentStep;

  return (
    <nav>
      <p>
        {currentStep.id} ({currentStep.index + 1} / {snapshot.steps.totalSteps})
      </p>
      <button
        disabled={currentStep.isFirstStep}
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
```

Every read is a snapshot field: `snapshot.currentStep.id/.index/.isFirstStep/.isLastStep/`
`.isFirstTimeVisit/.metadata/.async`, `snapshot.steps.totalSteps/.stepOrder`,
`snapshot.history.visited`, `snapshot.status`, `snapshot.machine.isLoading/.isPaused`, and
`snapshot.context`. Every command is a machine group: `machine.navigate.*` (including linear
`goToStepByIndex`), `machine.controls.*`, `machine.context.update(updater)`, and
`machine.async.clearError()`. Navigation methods return Core `NavigationResult` values, and
`goToNextStep` first runs work registered for the active step. See
[Machine API](/docs/core/api/machine-api) and [Snapshot](/docs/core/snapshot) for the complete
contracts.

## `useSelector()`

Prefer the bundle's selector hook when a component needs only one changing value:

```tsx
const isLoading = checkout.useSelector((snapshot) => snapshot.machine.isLoading);
```

The optional equality function controls when React re-renders. Selectors should be pure and should
not mutate snapshot data.

## `useStep()`

A step component can register transactional work that must succeed before forward navigation:

```tsx
function ShippingStep() {
  checkout.useStep({
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
`machine.navigate.registerNextStepInterceptor(stepId, work)`: it registers work for the currently
rendered step, and `machine.navigate.goToNextStep()` runs it when no explicit work is passed.
`run` happens before movement; `commit` publishes its updates atomically with movement. A failed
run leaves the source step and context in place, and the error lands in
`snapshot.currentStep.async.error` until `machine.async.clearError()`;
`snapshot.machine.isLoading` is `true` while the work is pending. The gate is forward-only:
timeline moves and `goToStepById` bypass it.

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

## Graph Provider

`createGraphJourney(definition, options?)` returns a bundle. It captures pure inputs, but creates a
Core machine only when its Provider mounts.

```tsx
<checkout.Provider
  views={{
    cart: Cart,
    shipping: Shipping,
    review: Review,
    done: Done
  }}
  context={{ cartId }}
  autoStart
>
  <checkout.StepRenderer fallback={<MissingStep />} />
  <Toolbar />
</checkout.Provider>
```

Each mount is independent. Strict Mode remount behavior does not create duplicate live machines, and
the owned machine is disposed after final unmount.

### Graph `useSnapshot()` and `useSelector()`

```tsx
const snapshot = checkout.useSnapshot();
const stepId = checkout.useSelector((value) => value.currentStep?.id);
```

Use the snapshot when several related values must be rendered together. Use a selector for leaf
components that should not re-render on unrelated context or plugin changes.

### Graph `useApi()`

```tsx
const api = checkout.useApi();

api.controls.pause();
api.controls.resume();
await api.navigate.goToPreviousStep();
await api.navigate.goToLastVisitedStep();
await api.send("continue");
api.updateContext((context) => ({ ...context, dirty: true }));
```

The returned command objects are the machine's stable grouped methods. `send` is narrowed to the
event union inferred from the definition.

### Graph event and lifecycle hooks

```tsx
checkout.useEvent("navigationBlocked", ({ reason, error }) => {
  report(reason, error);
});

checkout.useStepLifecycle("review", {
  onEnter: ({ context }) => analytics.viewed("review", context),
  onLeave: ({ context }) => analytics.left("review", context)
});

const reviewAsync = checkout.useStepAsyncState("review");
```

`useEvent` requires an exact Core subscription name and receives its exact payload. The listener
reference can change without forcing a new subscription. Step lifecycle callbacks observe a
specific step and do not replace authored Core `onEnter` or `onLeave` hooks.

### `useMachine()` and `machineRef`

`useMachine()` is appropriate for a child integration component. `machineRef` is useful when the
attachment must live above or beside the Provider:

```tsx
const [machine, setMachine] = React.useState(null);

React.useEffect(() => {
  if (!machine) return;
  return attachJourneyDevtools(machine, { mutationsEnabled: false });
}, [machine]);

return (
  <checkout.Provider views={views} machineRef={setMachine}>
    <checkout.StepRenderer />
  </checkout.Provider>
);
```

The ref receives `null` on unmount. Do not retain a Provider-owned machine after that point.

## Headless hooks

Headless hooks take an existing Core machine as their first argument:

```tsx
const snapshot = useJourneySnapshot(machine);
const status = useJourneySelector(machine, (value) => value.status);
useJourneyEvent(machine, "statusChange", listener);
useJourneyStepLifecycle(machine, "review", callbacks);
const asyncState = useStepAsyncState(machine, "review");
```

They require no Journey Provider and do not own or dispose the supplied machine.
`useOwnedJourney(factory)` is the exception: it deliberately creates a machine for the component
and disposes it during teardown.
