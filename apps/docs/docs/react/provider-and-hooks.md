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
- Independent journeys require separate runtimes.
- For component-owned / per-instance / SSR-safe ownership, [`useJourney`](/docs/react/overview#usejourney) builds a runtime, keeps it stable, and disposes it on unmount — the recommended default outside a single app-level singleton.
- `createJourneyFactory(...)` returns a typed `() => runtime` thunk for producing fresh runtimes (pass it to `useJourney`, or call it in non-React code).

This is the tradeoff that keeps the React API fully typed without repeating generics at each hook callsite. See [Runtime ownership](/docs/react/overview#runtime-ownership) for the full decision guide.

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

- `checkout.useStepAsyncState(stepId)`
  Read one step's async phase (`idle` / `invoking` / `evaluating-when` / `error`) for loading and error UI.

- `checkout.useJourneyEvent(listener)`
  Subscribe to typed lifecycle and telemetry events.

- `checkout.useJourneyApi()`
  Safe action surface for UI controls.

- `checkout.useStepApi(stepId)`
  Same action surface as `useJourneyApi()`, but with `send(...)` narrowed to custom events handled by that step or `global`.

- `checkout.useJourneyStepLifecycle(stepId, callbacks)`
  Run stable side effects when a specific step is entered or left.

Hooks do not need a provider because they are closed over the created machine. Without a provider, startup is manual through `checkout.useJourneyApi().startJourney()` or `checkout.machine.startJourney()`.
Server rendering still reads the initial `idled` snapshot. Provider-owned startup happens after hydration on the client.
Use `@rxova/journey-react` for server-safe imports and `@rxova/journey-react/client` when a Next.js App Router client boundary should be explicit.

If a component owns the runtime, use [`useJourney`](/docs/react/overview#usejourney) — it builds the
runtime once, survives StrictMode, and disposes it on unmount, so you never wire `useMemo` +
`disposeOnUnmount` by hand:

```tsx
const CheckoutCard = () => {
  const checkout = useJourney(() => createJourney(definition));

  return (
    <checkout.JourneyProvider views={views}>
      <checkout.StepRenderer />
    </checkout.JourneyProvider>
  );
};
```

For request-scoped or route-scoped SSR usage, put `useJourney` inside the owned `"use client"` boundary
instead of exporting a module singleton (which would be shared across every request):

```tsx
"use client";

export function CheckoutFlow({ customerId }: { customerId: string }) {
  const checkout = useJourney(() =>
    createJourney({ ...definition, context: { ...definition.context, customerId } })
  );

  return (
    <checkout.JourneyProvider views={views}>
      <checkout.StepRenderer />
    </checkout.JourneyProvider>
  );
}
```

Two isolated journeys on one screen are just two `useJourney` calls — each mount owns and disposes its
own runtime:

```tsx
const CheckoutCard = () => {
  const checkout = useJourney(() => createJourney(definition));

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

:::caution Owning vs. sharing

A module-level singleton survives showing and hiding `JourneyProvider` — the provider does not dispose
by default, so the journey keeps its state:

```tsx
// ✅ Shared, persistent: hiding the provider does not dispose the runtime
const journey = createJourney(definition);

function App() {
  const [show, setShow] = React.useState(true);
  return show ? <journey.JourneyProvider views={views}>...</journey.JourneyProvider> : null;
}
```

When each mount should get a **fresh, isolated** machine that cleans up after itself, make it
component-owned with `useJourney`, and reset it by remounting the owner with a `key`:

```tsx
// ✅ Owned: a fresh machine per mount, disposed on unmount
function CheckoutCard() {
  const journey = useJourney(() => createJourney(definition));
  return (
    <journey.JourneyProvider views={views}>
      <journey.StepRenderer />
    </journey.JourneyProvider>
  );
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

### Available fields

| Field              | Type                                | Available when      |
| ------------------ | ----------------------------------- | ------------------- |
| `mode`             | `"linear" \| "graph" \| "headless"` | always              |
| `activeStepId`     | `TStepId`                           | always              |
| `activeStepIndex`  | `number`                            | always              |
| `visitedStepCount` | `number`                            | always              |
| `isLoading`        | `boolean`                           | always              |
| `isIdle`           | `boolean`                           | always              |
| `isRunning`        | `boolean`                           | always              |
| `isComplete`       | `boolean`                           | always              |
| `isTerminated`     | `boolean`                           | always              |
| `isInitialStep`    | `boolean`                           | always              |
| `stepCount`        | `number`                            | `mode === "linear"` |
| `journeyLength`    | `number`                            | `mode === "linear"` |
| `isFirstStep`      | `boolean`                           | `mode === "linear"` |
| `isLastStep`       | `boolean`                           | `mode === "linear"` |
| `stepOrder`        | `readonly TStepId[]`                | `mode === "linear"` |

`stepCount`, `journeyLength`, `isFirstStep`, `isLastStep`, and `stepOrder` are `undefined` for `"graph"` and `"headless"` modes. Narrow on `computed.mode === "linear"` before accessing them.

## `useJourneyApi()` Surface

Common methods:

- `startJourney()`
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

## `useStepApi(stepId)`

Use `useStepApi(stepId)` inside step components when you want TypeScript to narrow `send(...)` to events that the current step can actually handle:

```tsx
const EmailCode = () => {
  const api = checkout.useStepApi("emailCode");

  return <button onClick={() => void api.send({ type: "verifyCode" })}>Verify</button>;
};
```

The narrowed event set includes custom events declared on that step plus custom events declared in `global`. Built-in methods such as `goToNextStep()`, `goToPreviousStep()`, `startJourney()`, and `resetJourney()` stay available.

## `useStepAsyncState(stepId)`

Use `useStepAsyncState(stepId)` to render a step's async state — a spinner while a step
[`effect`](/docs/core/effects) runs, a disabled state while an async guard evaluates, an error panel
when something rejects. It returns the step's `{ phase, eventType, transitionId, error }` and is
backed by `useJourneySelector` with a shallow equality, so it re-renders only when that step's async
slice changes.

```tsx
const Verify = () => {
  const { phase, error } = checkout.useStepAsyncState("verify");
  const api = checkout.useJourneyApi();

  if (phase === "invoking") return <Spinner />;
  if (phase === "error")
    return <ErrorPanel message={String(error)} onRetry={() => api.clearStepError("verify")} />;
  return <VerifyForm />;
};
```

`phase` is one of `idle`, `invoking` (a step effect is running), `evaluating-when` (an async guard is
deciding), or `error`. [Async UI](./async-ui) covers the phase-to-view mapping end to end.

## `useJourneyStepLifecycle(stepId, callbacks)`

Use `useJourneyStepLifecycle(stepId, callbacks)` to run side effects when a specific step is entered or left. It is built on `useJourneyEvent` internally, so the latest callback is always used without re-subscribing.

```tsx
checkout.useJourneyStepLifecycle("payment", {
  onEnter: ({ context }) => {
    analytics.track("payment_step_entered", { userId: context.userId });
  },
  onLeave: ({ context }) => {
    analytics.track("payment_step_left", { userId: context.userId });
  }
});
```

Both `onEnter` and `onLeave` are optional. Each receives `{ context }` with the current machine context at the time of the event.

This hook does not need a provider — it is closed over the created machine and subscribes directly.

## Provider Errors

`JourneyProvider` accepts:

- `onError(error, { phase: "start" })`

Use `useJourneyEvent(...)` or the underlying machine subscriptions for lifecycle observation.

## Direct Machine Access

Use the returned `machine` when you need low-level subscriptions or external integrations:

```tsx
const checkout = createJourney(definition);

checkout.machine.subscribe(() => {
  console.log(checkout.machine.getSnapshot());
});

checkout.machine.subscribeReset((event) => {
  console.log("reset", event.stepId);
});

checkout.machine.startJourney();
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
