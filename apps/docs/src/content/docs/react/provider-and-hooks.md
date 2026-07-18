---
title: Provider and Hooks API
sidebar_position: 3
---

This page focuses on React ownership and subscription behavior. Runtime navigation, lifecycle, and
snapshot semantics come directly from Core; see [Core API](/docs/core/api) and
[Lifecycle](/docs/core/lifecycle).

## `<LinearJourney>`

`<LinearJourney>` derives a Core linear definition from its direct children. Every step must have a
unique `id`, either directly on the element or through `<LinearJourney.Step>`.

```tsx
<LinearJourney
  context={initialContext}
  startStepId="shipping"
  header={<Progress />}
  footer={<Controls />}
  fallback={<p>Journey unavailable</p>}
  onStepChange={(change) => analytics.track("step", change)}
>
  <Account id="account" />
  <Shipping id="shipping" />
  <Review id="review" />
</LinearJourney>
```

Important props include:

| Prop                          | Meaning                                                      |
| ----------------------------- | ------------------------------------------------------------ |
| `context`                     | Initial shared context                                       |
| `startIndex` / `startStepId`  | Initial declared position; step ID wins                      |
| `header` / `footer`           | Content rendered inside journey context                      |
| `wrapper`                     | Element cloned around the active step                        |
| `fallback`                    | Content shown when no step can render                        |
| `onStart`                     | Fires after the first step starts                            |
| `onStepChange`                | Reports source, destination, indexes, direction, and context |
| `onStepEnter` / `onStepLeave` | Global lifecycle observation                                 |
| `onComplete`                  | Reports final context and snapshot                           |
| `onError`                     | Handles owned start/navigation/step-handler errors           |
| `persist`                     | Persistence-plugin sugar                                     |
| `plugins`                     | Core plugins installed on the owned machine                  |
| `machineRef`                  | Imperative access for integration code                       |

The step list is frozen at mount. Journey reports a development error if the derived IDs change,
because changing the declared order would invalidate history and index semantics.

## `useLinearJourney()`

This hook must run below the matching linear component.

```tsx
function Controls() {
  const {
    activeStepId,
    isFirstStep,
    isLastStep,
    isLoading,
    error,
    goToNextStep,
    goToPreviousStep,
    controls,
    context,
    updateContext,
    snapshot
  } = useLinearJourney<CheckoutContext>();

  // ...
}
```

Navigation methods return Core `NavigationResult` values. `goToNextStep` first runs work
registered for the active step, then delegates to Core. Lifecycle methods remain grouped on
`controls`.

`clearError()` clears the active entry's async error. `snapshot` is the complete immutable Core
linear snapshot when a component needs fields not projected onto the convenience result.

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

The hook registers work for the currently rendered step. `run` happens before movement;
`commit` publishes its updates atomically with movement. A failed run leaves the source step and
context in place.

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
