---
id: autosave
title: Autosave
sidebar_label: Autosave
---

# Autosave

Autosave is persistence with a UX layer. It debounces writes, can hydrate from storage, and — the
part persistence doesn't give you — exposes a save status you can render ("Saving…", "Saved",
"Couldn't save"). Reach for it when you're saving drafts and the user expects to see that happening.

## Install and use

```ts
import { createLinearJourney } from "@rxova/journey-core";
import { createAutosavePlugin } from "@rxova/journey-core/autosave";

const machine = createLinearJourney(checkout, {
  plugins: [
    createAutosavePlugin({
      key: "journey.checkout.draft",
      debounceMs: 500,
      allowList: ["profile", "shipping", "billing"],
      blockList: ["billing.cardNumber"]
    })
  ]
});
```

## What you get

The plugin adds three methods:

```ts
machine.getAutosaveState();
machine.flushAutosave();
machine.clearAutosave();
```

`getAutosaveState()` is what you bind your save indicator to:

```ts
type JourneyAutosaveState = {
  status: "idle" | "pending" | "saved" | "error";
  lastSavedAt?: number;
  pendingReason?: "context" | "navigation" | "reset" | "start" | "transition" | "async";
  error?: unknown;
};
```

## Options

| Option                      | What it does                                                      |
| --------------------------- | ----------------------------------------------------------------- |
| `key`                       | Unique storage key                                                |
| `storage`                   | Custom storage adapter                                            |
| `debounceMs`                | Delay before a write commits                                      |
| `hydrate`                   | Whether to restore the last draft into the initial snapshot       |
| `saveOn`                    | Which snapshot-change reasons trigger a save                      |
| `allowList` / `blockList`   | Filter which `context` paths get stored                           |
| `clearOnReset`              | Remove the entry on reset instead of writing the initial snapshot |
| `serialize` / `deserialize` | Custom codecs                                                     |
| `migrate(value, version)`   | Upgrade older payloads                                            |
| `onSaved(details)`          | Callback after a successful save                                  |
| `onError(error)`            | Storage or serialization error handler                            |

## How it behaves

Autosave schedules writes from committed snapshot changes. `async`-only changes are ignored,
`flushAutosave()` forces the pending write immediately, and `clearAutosave()` removes the draft and
resets the status. With `hydrate` on, the last saved draft is restored into the initial snapshot
before the runtime starts.

A pending debounced write is **discarded on `dispose()`**, not flushed. In React this is rarely an
issue — `JourneyProvider` keeps the machine alive across unmount by default (`disposeOnUnmount` is
`false`), so a normal unmount never drops a pending draft. If you do tear a machine down with work
pending (a manual `dispose()`, or opting into `disposeOnUnmount`), call `flushAutosave()` first to
persist the last change.

```ts
await machine.startJourney();
await machine.updateContext((context) => ({ ...context, email: "ada@example.com" }));

machine.getAutosaveState(); // { status: "pending", ... }
await machine.flushAutosave();
machine.getAutosaveState(); // { status: "saved", lastSavedAt: … }
```

## Autosave or persistence?

They share the same filtering and migration model, but solve different jobs:

- **[Persistence](/docs/core/persistence)** — durable snapshots with minimal ceremony. You want the
  flow to survive a reload and that's it.
- **Autosave** — debounced drafts, a save-status API, and explicit flush/clear controls. You want the
  user to _see_ their progress being saved.

Use one or the other for a given key; they're not meant to be stacked on the same storage entry.

## Where to next

- [Persistence](/docs/core/persistence) — the simpler durable-snapshot option.
- [Lifecycle & events](/docs/core/lifecycle) — the change reasons behind `saveOn` and `pendingReason`.
