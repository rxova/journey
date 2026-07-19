---
title: Provider and Hooks API
sidebar_position: 3
---

This page focuses on React ownership and subscription behavior. Runtime navigation, lifecycle, and
snapshot semantics come directly from Core; see [Core API](/docs/core/api) and
[Lifecycle](/docs/core/lifecycle).

## `<LinearJourney>`

`<LinearJourney>` derives a Core linear definition from its direct children. Every step must have a
unique `id`, either directly on the element or through `<LinearJourney.Step>`. The wrapper also
accepts Core's per-step config: `metadata` plus `onEnter`/`onLeave` hooks.

```tsx
<LinearJourney.Step id="shipping" metadata={{ title: "Shipping" }}>
  <Shipping />
</LinearJourney.Step>
```

Declared `metadata` surfaces at `snapshot.currentStep.metadata` while the step is current; there is
no separate per-step metadata lookup.

```tsx
<LinearJourney
  context={initialContext}
  startAt="shipping"
  header={<Progress />}
  footer={<Controls />}
  fallback={<p>Journey unavailable</p>}
  onStepEnter={({ from, to, direction }) => analytics.track("step", { from, to, direction })}
>
  <Account id="account" />
  <Shipping id="shipping" />
  <Review id="review" />
</LinearJourney>
```

Important props include:

| Prop                          | Meaning                                                                 |
| ----------------------------- | ----------------------------------------------------------------------- |
| `context`                     | Initial shared context                                                  |
| `startIndex` / `startAt`      | Starting step; `startAt` is Core's option and wins over the index sugar |
| `header` / `footer`           | Content rendered inside journey context                                 |
| `wrapper`                     | Element cloned around the active step                                   |
| `fallback`                    | Content shown when no step can render                                   |
| `onStart`                     | Fires once per mount with the start snapshot                            |
| `onStepEnter` / `onStepLeave` | Verbatim Core `stepEnter` / `stepLeave` event payloads                  |
| `onComplete`                  | Core `statusChange` payload, forwarded when `current === "completed"`   |
| `onError`                     | Verbatim Core `error` event payload                                     |
| `persist`                     | Core's `persist` creation option (`JourneyPersistOption`)               |
| `plugins`                     | Core plugins installed on the owned machine                             |
| `machineRef`                  | Imperative access for integration code                                  |

Callback props are verbatim forwards of Core subscription events. `onStepEnter` receives
`{ snapshot, from, to, direction }`, where `direction` is `"forward" | "backward" | "jump"` by
intent: only `goToNextStep` and `goToPreviousStep` report `"forward"`/`"backward"`; the initial
entry, `goToStepById`, `goToStepByIndex`, and `goToLastVisitedStep` report `"jump"`.
`onStepLeave` receives `{ snapshot, from, to }`, `onComplete` receives
`{ snapshot, previous, current }`, and `onError` receives `{ snapshot, error, phase, stepId }`.

`startAt` starts the journey directly at that step: earlier steps are never entered or visited,
their `onEnter`/`onLeave` hooks never fire, the timeline begins as `[startAt]`, and
`controls.restart()` returns to it. An unknown `startAt` id throws at mount.

The step list is frozen at mount. Journey reports a development error if the derived IDs change,
because changing the declared order would invalidate history and index semantics.

## `useLinearJourney()`

This hook must run below the matching linear component. It returns the underlying Core machine and
its live snapshot, verbatim — there is no React-only convenience shape:

```tsx
function Controls() {
  const { machine, snapshot } = useLinearJourney<CheckoutContext>();

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

## `useLinearJourneySelector()`

Prefer a selector when a component needs only one changing value:

```tsx
const isLoading = useLinearJourneySelector((snapshot) => snapshot.machine.isLoading);
```

The optional equality function controls when React re-renders. Selectors should be pure and should
not mutate snapshot data.

## `useLinearJourneyStep()`

A step can register transactional work that must succeed before forward navigation:

```tsx
function ShippingStep() {
  useLinearJourneyStep({
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
`snapshot.currentStep.async.error` until `machine.async.clearError()`.

## Typed linear bundles

```ts
const checkout = createLinearJourney<CheckoutContext>()(["account", "shipping", "review"] as const);
```

The bundle provides typed versions of the component and three hooks. It also offers
`toGraphDefinition(context)` as a migration aid when an ordered flow grows into named graph events.

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
