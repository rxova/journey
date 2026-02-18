---
title: Provider and Hooks API
sidebar_position: 3
---

This page documents the React binding surface in detail.

## `JourneyProvider`

```tsx
<JourneyProvider
  journey={journey}
  persistence={{ key: "signup", version: 1 }}
  history={{ maxHistory: 20 }}
  resetOnJourneyChange={false}
>
  <JourneyStepRenderer />
</JourneyProvider>
```

### Props

- `journey` (required): `JourneyReactDefinition`
- `machine` (optional): external machine instance
- `persistence` (optional): forwarded to internal machine creation
- `history` (optional): forwarded to internal machine creation
- `resetOnJourneyChange` (optional, default `false`)
- `children` (required)

If `machine` is provided, provider uses that machine and does not create internal one.

## `JourneyStepRenderer`

```tsx
<JourneyStepRenderer fallback={<NotFoundStep />} />
```

- Renders `journey.steps[snapshot.current].component`
- Uses `fallback` when current step has no mapped component

## `useJourneySnapshot`

```tsx
const snapshot = useJourneySnapshot<Context, StepId>();
```

- Subscribes via `useSyncExternalStore`
- Triggers rerender when machine snapshot changes

## `useJourneyApi`

```tsx
const api = useJourneyApi<Context, StepId, CustomEvent, PayloadMap>();

await api.next();
await api.back();
await api.submit();
await api.close();
await api.goTo("review");
await api.send({ type: "retry" });

api.updateContext((ctx) => ({ ...ctx, dirty: true }));
api.clearStepError();
api.reset();
api.trimHistory(10);
api.clearHistory();
```

## `useJourneyMachine`

```tsx
const machine = useJourneyMachine<Context, StepId, CustomEvent, PayloadMap>();
```

- Returns the underlying `JourneyMachine` from provider context.
- Useful for explicit integrations such as devtools bridges.

## `useJourney`

```tsx
const { snapshot, api } = useJourney<Context, StepId, CustomEvent, PayloadMap>();
```

Returns the combined snapshot + API object.

## Provider Boundary Error

Hooks throw if used outside provider:

- `useJourney must be used within <JourneyProvider>.`

This is intentional to fail fast and avoid silent null behavior.
