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

## The `persist` creation option

For the common case, every factory accepts `persist` as sugar over the plugin:

```ts
const machine = createLinearJourney(definition, {
  persist: { key: "checkout" }
});
```

`persist` expands into the persistence plugin, prepended to `plugins`. `storage` is optional here
and defaults to `globalThis.localStorage`; creation throws when neither a `storage` value nor
`localStorage` is available. Combining `persist` with an explicitly registered persistence plugin
fails at creation as a duplicate plugin name. Use the explicit plugin form when you need
`clearOnTerminate` or an injected clock.

Unlike the explicit plugin, `persist` also [restores](#restore): a valid record found at creation
seeds the machine so the first `start()` resumes where the record left off.

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

## Restore behavior {#restore}

The creation-time `persist` option restores. At creation, the factory reads the stored record; when
it is restorable, the record seeds context, timeline, and pointer, and the first `start()` re-enters
the persisted current step instead of the first/initial one:

```ts
const machine = createLinearJourney(definition, {
  persist: { key: "checkout" }
});

machine.controls.start();
// resumes at the persisted step when a valid record existed
```

A record is restorable when its status is `running` or `paused`, its `currentIndex` points inside
its timeline, and every timeline step is declared by the current definition. Anything else —
terminal-status records, definition drift, malformed or foreign payloads, a throwing storage read —
is ignored and the journey starts fresh. Restore is best-effort by design and never throws.

Details of a restored start:

- the initial entry runs as a normal `stepEnter` with `from: null` and `direction: "jump"`;
- visit counts are reconstructed from the restored timeline, so the re-entered step reports
  `isFirstTimeVisit: false`;
- an explicit `startAt` option wins over the persisted record;
- `restart()` always begins a fresh run — the seed applies only to the first `start()`.

Registering `createPersistencePlugin` explicitly in `plugins` stays save-only: plugins are
observe-only and cannot seed the runtime. Use the `persist` option when you want restore.

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
