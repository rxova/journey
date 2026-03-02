---
id: persistence
title: Persistence
sidebar_label: Persistence
---

Persistence is optional. Add it when your product needs resume-later behavior.

Journey keeps persistence versioned and migration-friendly, so you can evolve flows without breaking existing users.

## Quick Start

```ts
const machine = createJourneyMachine(journey, {
  persistence: {
    key: "journey.checkout",
    version: 2
  }
});
```

## What Gets Persisted

Journey persists the runtime snapshot shape that matters for recovery:

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

This is enough to restore where the user is, how they got there, and what data the flow depends on.

## Persistence Options

- `key`: unique storage key.
- `storage`: custom adapter (defaults to `localStorage` when available).
- `version`: schema version for persisted data.
- `migrate(value, persistedVersion)`: convert older data to current shape.
- `clearOnReset`: decide whether reset removes persisted entry.
- `serialize` / `deserialize`: custom codecs.
- `onError(error)`: error handler for persistence failures.

## Migration Example

```ts
const machine = createJourneyMachine(journey, {
  persistence: {
    key: "journey.checkout",
    version: 2,
    migrate: (value, persistedVersion) => {
      if (persistedVersion === 1) {
        return {
          ...value,
          context: {
            ...value.context,
            couponCode: value.context.couponCode ?? null
          }
        };
      }
      return value;
    }
  }
});
```

## Safety Behavior

If persisted data is invalid for the current journey shape, hydration falls back to a valid initial snapshot.

This protects users from corrupted or outdated stored state.

## Reset Behavior

- `clearOnReset: true` -> reset removes persisted data.
- `clearOnReset: false` -> reset writes the new initial snapshot.

Choose based on whether "reset" means "start over clean" or "restart and keep recovery state" in your product.
