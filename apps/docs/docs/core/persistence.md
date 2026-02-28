---
id: persistence
title: Persistence
sidebar_label: Persistence
---

## Overview

Persistence is optional and configured via machine options:

```ts
const machine = createJourneyMachine(journey, {
  persistence: {
    key: "journey.checkout",
    version: 2
  }
});
```

## Persisted Snapshot Shape

```ts
type JourneyPersistedSnapshot<TContext, TStepId extends string, TStepMeta = unknown> = {
  currentStepId: TStepId;
  history: {
    timeline: readonly TStepId[];
    index: number;
  };
  context: TContext;
  status: "running" | "complete" | "terminated";
  visited: Record<TStepId, boolean>;
  stepMeta: Record<TStepId, TStepMeta>;
};
```

## Options

- `key`: storage key.
- `storage`: custom storage adapter (`localStorage` by default when available).
- `version`: persisted schema version.
- `migrate(value, persistedVersion)`: map old data to current snapshot shape.
- `clearOnReset`: if `true`, reset removes persisted state.
- `serialize` / `deserialize`: custom codecs.
- `onError(error)`: persistence error callback.

## Migration Notes

If persisted data is invalid for the current snapshot shape, hydration falls back to the initial snapshot.

A migration function should return current snapshot fields (`history.timeline`, `history.index`, `visited`, `stepMeta`, etc.).

## Reset Behavior

- `clearOnReset: true` => storage entry removed.
- `clearOnReset: false` => reset snapshot persisted.
