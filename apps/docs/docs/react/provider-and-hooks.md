---
title: Provider and Hooks API
sidebar_position: 3
---

React bindings are the UI-facing wrapper for the core machine.

Use this page for React integration details.
Use Core docs for runtime semantics: [Core API](/docs/core/api) and [Core Lifecycle](/docs/core/lifecycle).

The value returned from `createJourney(...)` is a `JourneyRuntime`.

## Ownership Model

One `createJourney(...)` call creates one machine instance immediately.

- `JourneyProvider` does not create a machine. It only supplies `views`, lifecycle callbacks, and provider-owned startup for the already-created runtime.
- Rendering the same runtime in multiple places shares one journey state.
- Independent journeys require separate `createJourney(...)` calls.
- `createJourneyFactory(...)` returns a typed helper for producing fresh runtimes from the same definition/options pair.

This is the tradeoff that keeps the React API fully typed without repeating generics at each hook callsite.

## `JourneyProvider` And `StepRenderer`

```tsx
const checkout = createJourney(definition);

<checkout.JourneyProvider views={views}>
  <checkout.StepRenderer />
</checkout.JourneyProvider>;
```

- `JourneyProvider` supplies `views` and lifecycle callbacks.
- `JourneyProvider` auto-starts an `idled` machine during the client commit phase, before child passive effects run.
- `JourneyProvider` does not dispose the machine by default.
- Provider-owned startup failures go to `onError(error, { phase: "start" })` when that callback is provided.
- Set `disposeOnUnmount` when the provider fully owns a component-scoped runtime and should clean it up on unmount.
- `StepRenderer` renders the component matching `snapshot.currentStepId`.
- `StepRenderer` must be used inside `JourneyProvider`.

## Hooks And Responsibilities

- `checkout.useJourneySnapshot()`
  Read-only runtime state for rendering.

- `checkout.useJourneyComputed()`
  Read-only derived state for step progress and lifecycle flags.

- `checkout.useJourneySelector(selector, equalityFn?)`
  Read only the selected part of snapshot state.

- `checkout.useJourneyEvent(listener)`
  Subscribe to typed lifecycle and telemetry events.

- `checkout.useJourneyApi()`
  Safe action surface for UI controls.

Hooks do not need a provider because they are closed over the created machine. Without a provider, startup is manual through `checkout.useJourneyApi().start()` or `checkout.machine.start()`.
Server rendering still reads the initial `idled` snapshot. Provider-owned startup happens after hydration on the client.
Use `@rxova/journey-react` for server-safe imports and `@rxova/journey-react/client` when a Next.js App Router client boundary should be explicit.

If a component owns the runtime, memoize it and opt into provider-owned disposal:

```tsx
const makeCheckoutJourney = createJourneyFactory(definition);

const CheckoutCard = () => {
  const checkout = React.useMemo(() => makeCheckoutJourney(), []);

  return (
    <checkout.JourneyProvider views={views} disposeOnUnmount>
      <checkout.StepRenderer />
    </checkout.JourneyProvider>
  );
};
```

For request-scoped or route-scoped SSR usage, put the runtime inside the owned client boundary instead of exporting a module singleton:

```tsx
"use client";

export function CheckoutFlow({ customerId }: { customerId: string }) {
  const checkout = React.useMemo(
    () =>
      createJourney({
        ...definition,
        context: {
          ...definition.context,
          customerId
        }
      }),
    [customerId]
  );

  return (
    <checkout.JourneyProvider views={views} disposeOnUnmount>
      <checkout.StepRenderer />
    </checkout.JourneyProvider>
  );
}
```

If you want two isolated journeys on one screen, create two runtimes:

```tsx
const CheckoutCard = () => {
  const checkout = React.useMemo(() => createJourney(definition), []);

  return (
    <checkout.JourneyProvider views={views}>
      <checkout.StepRenderer />
    </checkout.JourneyProvider>
  );
};

export const DualCheckout = () => (
  <>
    <CheckoutCard />
    <CheckoutCard />
  </>
);
```

:::caution Module singletons and conditional rendering

Module-level singletons are safe to show and hide with `JourneyProvider` because the provider does not dispose by default.

```tsx
// ✅ Safe: hiding the provider does not dispose the shared runtime
const journey = createJourney(definition);

function App() {
  const [show, setShow] = React.useState(true);
  return show ? <journey.JourneyProvider views={views}>...</journey.JourneyProvider> : null;
}
```

If the runtime is component-owned, opt into provider disposal so each mount gets a fresh machine:

```tsx
// ✅ Each mount creates a fresh machine and disposes it on unmount
function App() {
  const [show, setShow] = React.useState(true);
  const journey = React.useMemo(() => createJourney(definition), []);
  return show ? (
    <journey.JourneyProvider views={views} disposeOnUnmount>
      ...
    </journey.JourneyProvider>
  ) : null;
}
```

:::

## `useJourneyComputed()`

Use `useJourneyComputed()` when the UI needs derived progress flags without duplicating machine logic in components.

```tsx
const computed = checkout.useJourneyComputed();

if (computed.mode === "linear") {
  return (
    <p>
      Step {computed.activeStepIndex + 1} of {computed.stepCount}
    </p>
  );
}

return <p>Current step: {computed.activeStepId}</p>;
```

This hook is read-only. Keep commands in `useJourneyApi()`.

## `useJourneyApi()` Surface

Common methods:

- `start()`
- `goToNextStep`
- `goToPreviousStep(steps?)`
- `goToLastVisitedStep()`
- `completeJourney`
- `terminateJourney`
- `send`
- `updateContext`
- `getStepMeta`
- `clearStepError`
- `resetJourney`

Imperative jump:

```ts
await api.goToStepById("review");
await api.send({ type: "goToStepById", stepId: "review", payload: { source: "link" } });
```

Guard and `updateContext` failures resolve through `result.error` instead of rejecting.

`updateContext` follows core timing semantics. It updates the visible snapshot immediately, but it does not re-run an async transition already in `evaluating-when`. If the change must affect the current transition, apply it before `send(...)` or await the transition first. See [Core Async Behavior](/docs/core/async).

## Provider Callbacks

`JourneyProvider` accepts:

- `onStart(event)`
- `onComplete(event)`
- `onTerminate(event)`
- `onError(error, { phase: "start" })`

They are thin wrappers over the machine lifecycle subscriptions.

- `onStart` fires when the provider transitions an `idled` machine to `running` on the client, including restarts after `resetJourney()`.
- `onComplete` and `onTerminate` only fire for emitted terminal lifecycle events.

## Direct Machine Access

Use the returned `machine` when you need low-level subscriptions or external integrations:

```tsx
const checkout = createJourney(definition);

checkout.machine.subscribe(() => {
  console.log(checkout.machine.getSnapshot());
});

checkout.machine.start();
```

`dispose()` is also returned as a convenience alias for `machine.dispose()`. `JourneyProvider` only disposes automatically when `disposeOnUnmount` is enabled, so shared or module-level runtimes can survive provider unmounts safely.

## Important Boundary

Even when called from React hooks, transition ordering, async phase handling, observability events, history behavior, and persistence are all defined by Core.

Reference pages:

- [Core Snapshot](/docs/core/snapshot)
- [Core Lifecycle](/docs/core/lifecycle)
- [Core Async Behavior](/docs/core/async)
- [Core Timeline Navigation](/docs/core/history)
- [Core Persistence](/docs/core/persistence)
- [Stability Contract](/docs/core/stability)
