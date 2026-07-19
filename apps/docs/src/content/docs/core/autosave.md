---
id: autosave
title: Autosave
---

# Autosave

Autosave debounces persisted-state writes driven by context, settled transitions, and status
changes.

## Install and use

```ts
import { createAutosavePlugin } from "@rxova/journey-core/autosave";

const machine = createLinearJourney(definition, {
  plugins: [
    createAutosavePlugin({
      storage: localStorage,
      key: "checkout-draft",
      debounceMs: 300,
      saveOn: ["context", "transition"]
    })
  ]
});
```

`storage` is required and uses the same adapter contract and persisted shape as the persistence
plugin.

Autosave is save-side only. It never seeds a machine: the creation-time restore behavior belongs to
the [`persist` option](./persistence#restore), which reads the persistence key, not the autosave
key. Read autosaved drafts yourself via `readPersisted()`.

## API

```ts
const autosave = machine.plugins.autosave;

autosave.getAutosaveState();
await autosave.flushAutosave();
autosave.clearAutosave();
autosave.readPersisted();
```

`flushAutosave()` cancels the timer and writes immediately. `clearAutosave()` cancels pending work,
resets plugin state, and removes the storage entry.

## Snapshot state

```ts
machine.getSnapshot().plugins.autosave;
// {
//   status: "idle" | "pending" | "saving" | "saved" | "error",
//   lastSavedAt: number | null,
//   error: unknown | null
// }
```

Use this namespaced value in selectors when the UI displays save status.

## Options

| Option       | Meaning                                                              |
| ------------ | -------------------------------------------------------------------- |
| `storage`    | Required storage adapter.                                            |
| `key`        | Required storage key.                                                |
| `debounceMs` | Debounce window, default `300`; values are clamped to at least zero. |
| `saveOn`     | Any of `context`, `transition`, and `status`; defaults to all three. |
| `now`        | Injectable clock, mainly for tests.                                  |

Disposing the machine cancels a pending debounce. It does not flush automatically.

## Where to next

- [Persistence](./persistence)
- [Plugins](./plugins/overview)
