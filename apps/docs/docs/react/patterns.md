---
title: React Patterns
sidebar_position: 4
---

Production patterns for keeping flow logic maintainable.

## Keep Journey Definitions Stable

Define `journey` outside components or memoize it.

```tsx
const journey = useMemo(() => createJourneyDefinition(flags), [flags]);
```

Avoid accidental machine recreation unless intentional.

## Keep Components Thin

Move branching/guard logic into transitions.

- Good: `when` decides route
- Bad: component-level `if` chains that duplicate navigation rules

## Async UI Pattern

```tsx
const { snapshot, api } = useJourney<Ctx, StepId>();
const current = snapshot.current;
const asyncState = snapshot.async.byStep[current];

if (asyncState.phase === "running-effect") return <Spinner />;
if (asyncState.phase === "error") {
  return <RetryPanel onDismiss={() => api.clearStepError(current)} />;
}
```

## Custom Events

Use custom events for domain intent:

```tsx
await api.send({ type: "retry", payload: { attempt: 2 } });
```

Prefer domain language over overloading `next` for everything.

## External Machine Ownership

If app shell owns lifecycle, pass `machine` prop to provider.

This is useful for integration tests, multi-root apps, and dependency-injected app architecture.

## Analytics Pattern

Subscribe once near app boundary and emit transition events from snapshot changes.

Avoid embedding analytics dispatch logic in every step component.
