---
title: TypeScript Types
sidebar_position: 7
---

React-specific types exported from `@rxova/journey-react`.

For shared types used across packages (`JourneyDefinition`, `JourneySnapshot`, `JourneyObservationEvent`, etc.), see [Core TypeScript](/docs/core/typescript).

## Runtime Types

### `JourneyRuntime`

The bundle returned by `createJourney(definition, options?)`.

```ts
type JourneyRuntime<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown> = Record<never, never>,
  TStepMeta = unknown,
  TPlugins extends readonly JourneyMachinePlugin[] = [],
  THandlers extends Record<string, unknown> = Record<never, never>
> = {
  machine: JourneyMachineWithPlugins<...>;
  dispose: () => void;
  useJourneySnapshot: () => JourneySnapshot<TContext, TStepId>;
  useJourneyComputed: () => JourneyComputed<TStepId>;
  useJourneySelector: <TSelected>(selector, equalityFn?) => TSelected;
  useJourneyApi: () => JourneyApi<TContext, TStepId, TEventMap, TStepMeta>;
  useJourneyEvent: (listener) => void;
  useJourneyStepLifecycle: (stepId, callbacks) => void;
  JourneyProvider: React.ComponentType<JourneyProviderProps<TStepId>>;
  StepRenderer: React.ComponentType<{ fallback?: React.ReactNode }>;
};
```

In practice the inferred form is easier to use — see `JourneyRuntimeFromDefinition` below.

---

### `JourneyRuntimeFromDefinition`

Infers all type parameters from a `JourneyDefinition` object. This is what `createJourney(definition)` returns when called with a typed definition.

```ts
type JourneyRuntimeFromDefinition<
  TDefinition,
  TPlugins extends readonly JourneyMachinePlugin[] = []
>
```

Usage:

```ts
const definition = { ... } satisfies JourneyDefinition<Context, StepId, EventMap>;
const checkout = createJourney(definition);

// The type of checkout is JourneyRuntimeFromDefinition<typeof definition>
type CheckoutRuntime = JourneyRuntimeFromDefinition<typeof definition>;
```

---

### `JourneyRuntimeFactory`

The type of the function returned by `createJourneyFactory(definition, options?)`. Calling it produces a fresh `JourneyRuntime`.

```ts
type JourneyRuntimeFactory<TContext, TStepId, TEventMap, TStepMeta, TPlugins, THandlers>
  = () => JourneyRuntime<...>
```

---

### `JourneyRuntimeFactoryFromDefinition`

Inferred factory type — equivalent to `() => JourneyRuntimeFromDefinition<TDefinition, TPlugins>`.

```ts
type JourneyRuntimeFactoryFromDefinition<
  TDefinition,
  TPlugins extends readonly JourneyMachinePlugin[] = []
> = () => JourneyRuntimeFromDefinition<TDefinition, TPlugins>;
```

---

### `JourneyBuilderRuntime` / `JourneyBuilderRuntimeFromDefinition`

Aliases for `JourneyRuntimeWithStepApi` and `JourneyRuntimeFromDefinition` respectively. These are the concrete types returned by `createJourney()` when using the builder API — they extend `JourneyRuntime` with a typed `useStepApi(stepId)` that narrows `send(...)` to events handled by the given step.

Use `JourneyBuilderRuntimeFromDefinition` when you need to annotate the runtime returned by `createJourney()`:

```ts
import type { JourneyBuilderRuntimeFromDefinition } from "@rxova/journey-react";

type CheckoutRuntime = JourneyBuilderRuntimeFromDefinition<typeof definition>;
```

---

### `JourneyBuilderRuntimeFactory` / `JourneyBuilderRuntimeFactoryFromDefinition`

Factory equivalents of the builder runtime types. These are the types returned by `createJourneyFactory()`.

```ts
import type { JourneyBuilderRuntimeFactoryFromDefinition } from "@rxova/journey-react";

type MakeCheckout = JourneyBuilderRuntimeFactoryFromDefinition<typeof definition>;
```

---

## Action Surface Types

### `JourneyApi`

The full action surface returned by `useJourneyApi()`.

```ts
type JourneyApi<
  TContext extends JourneyJsonObject,
  TStepId extends string,
  TEventMap extends Record<string, unknown> = Record<never, never>,
  TStepMeta = unknown
> = {
  startJourney: () => Promise<JourneySnapshot<TContext, TStepId>>;
  send: (
    event: JourneySendEvent<TStepId, TEventMap>
  ) => Promise<JourneySendResult<TContext, TStepId>>;
  goToNextStep: () => Promise<JourneySendResult<TContext, TStepId>>;
  goToStepById: (stepId: TStepId) => Promise<JourneySendResult<TContext, TStepId>>;
  goToPreviousStep: (steps?: number) => Promise<JourneySendResult<TContext, TStepId>>;
  goToLastVisitedStep: () => Promise<JourneySendResult<TContext, TStepId>>;
  completeJourney: (payload?) => Promise<JourneySendResult<TContext, TStepId>>;
  terminateJourney: (payload?) => Promise<JourneySendResult<TContext, TStepId>>;
  clearStepError: (stepId?: TStepId) => Promise<JourneySnapshot<TContext, TStepId>>;
  updateContext: (
    updater: (context: TContext) => TContext
  ) => Promise<JourneySnapshot<TContext, TStepId>>;
  getStepMeta: (stepId: TStepId) => TStepMeta | undefined;
  resetJourney: () => Promise<JourneySnapshot<TContext, TStepId>>;
};
```

All async methods resolve through `result.error` instead of rejecting, so `void api.goToNextStep()` is safe from unhandled promise rejections.

---

### `StepScopedJourneyApi`

The type returned by `useStepApi(stepId)`. Identical to `JourneyApi` but with `send(...)` narrowed to custom events declared on the given step or in `global` transitions.

```ts
type StepScopedJourneyApi<
  TContext,
  TStepId,
  TEventMap,
  TAllowedEventType extends keyof TEventMap & string = never,
  TStepMeta = unknown
> = Omit<JourneyApi<TContext, TStepId, TEventMap, TStepMeta>, "send"> & {
  send: (event: { type: TAllowedEventType; payload?: ... }) => Promise<...>;
};
```

---

## Component and Provider Types

### `JourneyViews`

The map of step id → React component passed to `JourneyProvider`.

```ts
type JourneyViews<TStepId extends string> = Record<TStepId, React.ComponentType>;
```

---

### `JourneyProviderProps`

Props accepted by the `JourneyProvider` component.

```ts
type JourneyProviderProps<TStepId extends string> = {
  views: JourneyViews<TStepId>;
  onError?: (error: unknown, context: JourneyProviderErrorContext) => void;
  disposeOnUnmount?: boolean;
  children: React.ReactNode;
};
```

---

### `JourneyProviderErrorContext`

The second argument passed to the `onError` callback.

```ts
type JourneyProviderErrorContext = {
  phase: "start";
};
```

`phase: "start"` covers provider-owned startup failures — errors thrown during `startJourney()` triggered by the provider.

---

## Re-exported Core Types

### `JourneyDefaultEvent`

Re-exported from `@rxova/journey-core`. The union of all built-in event type strings (`"goToNextStep"`, `"completeJourney"`, etc.).

```ts
import type { JourneyDefaultEvent } from "@rxova/journey-react";
```

For all other core types (`JourneyDefinition`, `JourneySnapshot`, `JourneyComputed`, `JourneyObservationEvent`, `JourneyMachinePlugin`, etc.), import directly from `@rxova/journey-core`. See [Core TypeScript](/docs/core/typescript).
