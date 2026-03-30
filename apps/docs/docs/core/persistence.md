---
id: persistence
title: Persistence Plugin
sidebar_label: Persistence Plugin
---

Persistence is an opt-in plugin for machines that should survive reloads, tab closes, or multi-session work.

It hydrates the starting snapshot from storage and persists later snapshot changes without pulling persistence code into the base runtime.

## Install And Use

```ts
import { createJourneyMachine } from "@rxova/journey-core";
import { createPersistencePlugin } from "@rxova/journey-core/persistence";

const machine = createJourneyMachine(journey, {
  plugins: [
    createPersistencePlugin({
      key: "journey.checkout",
      version: 2,
      blockList: ["auth.password"]
    })
  ]
});
```

Hydrated machines still start as `idled`. If persisted data said the flow was previously `running`, Journey restores the snapshot shape and current step but waits for an explicit `start()` before accepting transition/navigation commands.

## What It Persists

The persistence plugin stores the runtime snapshot shape that matters for recovery:

```ts
type JourneyPersistedSnapshot<TContext, TStepId extends string> = {
  currentStepId: TStepId;
  history: {
    timeline: readonly TStepId[];
    index: number;
  };
  context: TContext;
  status: "idled" | "running" | "completed" | "terminated";
  visited: Record<TStepId, boolean>;
};
```

That is enough to restore where the user is, how they got there, and the data the flow depends on.

If you configure `allowList` or `blockList`, the plugin stores a filtered `context` instead of the entire one.

## Options

- `key`: unique storage key
- `storage`: custom storage adapter
- `version`: persisted schema version
- `migrate(value, persistedVersion)`: migrate older payloads
- `clearOnReset`: remove storage entry on reset instead of writing the initial snapshot
- `allowList`: persist only matching dot-separated context paths
- `blockList`: remove matching dot-separated context paths before storage
- `serialize` / `deserialize`: custom codecs
- `onError(error)`: persistence error handler

Path filters are rooted at `context` and use exact dot notation for object keys:

- `auth.password`
- `profile.contact.email`
- `preferences`

Rules:

- Parent paths include the full subtree below them.
- `blockList` wins when a path appears in both lists.
- Arrays are filterable only through their parent key such as `cart.items`, not with per-index paths.
- Invalid path entries are reported through `onError(error)` and disable persistence for that machine instance.

## Context Filtering Example

```ts
const machine = createJourneyMachine(journey, {
  plugins: [
    createPersistencePlugin({
      key: "journey.checkout",
      allowList: ["profile", "auth", "preferences.theme", "cart.items"],
      blockList: ["auth.password"]
    })
  ]
});
```

In that example:

- `profile` is persisted as a full subtree.
- `auth` is persisted, except for `auth.password`.
- `preferences` keeps only `theme`.
- `cart.items` keeps the full array value.
- `auth.password` is never stored, even if `auth` is otherwise allowed.

## Migration Example

```ts
const machine = createJourneyMachine(journey, {
  plugins: [
    createPersistencePlugin({
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
    })
  ]
});
```

If `migrate(...)` returns data that cannot be coerced into a valid snapshot, Journey reports the problem through `onError(error)` or, when `onError` is omitted, a development warning. Hydration then falls back to the initial snapshot.

## Runtime Behavior

The plugin does three things:

1. Builds a persistence controller during machine setup.
2. Hydrates the initial snapshot before normal runtime work begins.
3. Persists later snapshot changes, except for async-only state transitions.

That last part is important. Async progress markers are runtime details, not recovery state. What matters for hydration is the last stable snapshot.

## Safety Behavior

If persisted data is missing, malformed, or no longer valid for the current journey shape, hydration falls back to a safe initial snapshot.

That keeps broken storage from producing broken flows.

When context filtering is enabled, hydration merges the stored filtered context onto the journey's initial context. Fields you intentionally omitted from storage, such as `auth.password`, fall back to their initial values after reload.

## Reset Behavior

- `clearOnReset: true` removes the persisted entry when the machine resets.
- `clearOnReset: false` writes the fresh initial `idled` snapshot back to storage.

Choose based on whether reset in your product means “start clean” or “restart but keep resume-later support”.
