---
id: persistence
title: Persistence
---

# Persistence

The persistence plugin writes a serializable state slice whenever transitions settle, context
changes, or status changes.

## Install and use

```ts
import { createPersistencePlugin } from "@rxova/journey-core/persistence";

const machine = createLinearJourney(definition, {
  plugins: [
    createPersistencePlugin({
      storage: localStorage,
      key: "checkout",
      clearOnTerminate: true
    })
  ]
});
```

`storage` must implement `getItem`, `setItem`, and `removeItem`. `setItem` may return a promise.

## Persisted shape

```ts
type JourneyPersistedState = {
  status: JourneyStatus;
  context: unknown;
  timeline: readonly string[];
  currentIndex: number;
  savedAt: number;
};
```

The plugin serializes this value with `JSON.stringify`. Keep persisted context serializable.

## API and snapshot

```ts
const api = machine.plugins.persistence;

api.inspectPersistedState(); // last value written by this machine
api.readPersisted(); // re-read and parse storage
api.clearPersisted();

machine.getSnapshot().plugins.persistence;
// { lastSavedAt: number | null }
```

Malformed or structurally invalid storage values return `null`.

## Restore behavior

The V1 plugin writes and reads persisted data but does not hydrate a live runtime's history. Read the
stored state before creating a machine and use the saved context according to your application's
restore policy.

```ts
const saved = persistencePluginRead();
const machine = createLinearJourney({
  ...definition,
  context: saved?.context ?? definition.context
});
```

History rehydration is planned separately; do not imply that registering this plugin moves a new
machine to a saved step.

## Options

| Option             | Meaning                                               |
| ------------------ | ----------------------------------------------------- |
| `storage`          | Required localStorage-compatible adapter.             |
| `key`              | Required storage key.                                 |
| `clearOnTerminate` | Remove the entry on termination; defaults to `false`. |
| `now`              | Injectable clock, mainly for tests.                   |

## Where to next

- [Autosave](./autosave)
- [Plugins](./plugins/overview)
