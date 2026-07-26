---
title: "Autosave Plugin"
---

Autosave is an opt-in plugin for draft-style persistence with UX-oriented runtime state.

It debounces snapshot writes, can hydrate the initial snapshot from storage, and exposes save status through the machine API. It is built on the same snapshot persistence behavior as Journey persistence, but it does not require consumers to register the persistence plugin separately.

## Install And Use

```ts
import { createJourneyMachine } from "@rxova/journey-core";
import { createAutosavePlugin } from "@rxova/journey-core/autosave";

const machine = createJourneyMachine(journey, {
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

## What You Get

The plugin augments the machine with:

```ts
type JourneyAutosaveMachineExtension = {
  getAutosaveState: () => JourneyAutosaveState;
  flushAutosave: () => Promise<void>;
  clearAutosave: () => void;
};
```

`getAutosaveState()` returns:

```ts
type JourneyAutosaveState = {
  status: "idle" | "pending" | "saved" | "error";
  lastSavedAt?: number;
  pendingReason?: "context" | "navigation" | "reset" | "start" | "transition" | "async";
  error?: unknown;
};
```

## Options

- `key`: unique storage key
- `storage`: custom storage adapter
- `debounceMs`: delay before writes are committed
- `hydrate`: whether to hydrate the initial snapshot from storage
- `saveOn`: snapshot-change reasons that should trigger autosave
- `allowList`: persist only matching context paths
- `blockList`: remove matching context paths before storage
- `clearOnReset`: remove storage entry on reset instead of writing the initial snapshot
- `serialize` / `deserialize`: custom codecs
- `migrate(value, persistedVersion)`: migrate older payloads
- `onSaved(details)`: callback after a successful autosave commit
- `onError(error)`: storage or serialization error handler

## Runtime Behavior

Autosave schedules writes from committed snapshot changes.

- `async` snapshot changes are ignored
- `reset` clears storage when `clearOnReset` is enabled
- `flushAutosave()` forces the pending write immediately
- `clearAutosave()` removes the stored draft and resets autosave state

When `hydrate` is enabled, the plugin restores the last saved draft into the initial machine snapshot before normal runtime work begins.

## Relationship To Persistence

Autosave is not a wrapper around `createPersistencePlugin(...)` at the public API level.

Use persistence when you want straightforward durable snapshots with minimal behavior.

Use autosave when you want:

- debounced draft saving
- save status for UI
- explicit flush/clear controls
- the same filtering and migration model as persistence

## Example

```ts
const machine = createJourneyMachine(journey, {
  plugins: [
    createAutosavePlugin({
      key: "journey.checkout.draft",
      debounceMs: 300,
      saveOn: ["context", "transition", "navigation"],
      onSaved: ({ timestamp }) => {
        console.log("draft saved", timestamp);
      }
    })
  ]
});

await machine.startJourney();
await machine.updateContext((context) => ({ ...context, email: "user@example.com" }));

const autosave = machine.getAutosaveState();
// { status: "pending" }

await machine.flushAutosave();
```
