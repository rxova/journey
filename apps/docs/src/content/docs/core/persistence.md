---
id: persistence
title: Persistence
sidebar_label: Persistence
---

# Persistence

When a flow should survive a reload, a closed tab, or a session that spans days, reach for the
persistence plugin. It hydrates the starting snapshot from storage and writes later changes back —
without dragging any storage code into the base runtime.

## Install and use

```ts
import { createLinearJourney } from "@rxova/journey-core";
import { createPersistencePlugin } from "@rxova/journey-core/persistence";

const machine = createLinearJourney(checkout, {
  plugins: [
    createPersistencePlugin({
      key: "journey.checkout",
      version: 2,
      blockList: ["auth.password"]
    })
  ]
});
```

A hydrated machine still starts `idled`. Even if storage said the flow was previously `running`,
Journey restores the snapshot and current step but waits for an explicit `startJourney()` before
accepting navigation — so resuming is always a deliberate act.

## What it stores

Persistence keeps the fields that matter for recovery — where the user is, how they got there, and
the data the flow depends on:

```ts
type PersistedSnapshotShape<TContext, TStepId extends string> = {
  currentStepId: TStepId;
  history: { timeline: readonly TStepId[]; index: number };
  context: TContext;
  status: "idled" | "running" | "completed" | "terminated";
  visited: Record<TStepId, boolean>;
};
```

Async progress markers are deliberately excluded — they're runtime details, not recovery state. What
matters on reload is the last stable snapshot.

## Options

| Option                             | What it does                                                      |
| ---------------------------------- | ----------------------------------------------------------------- |
| `key`                              | Unique storage key                                                |
| `storage`                          | Custom storage adapter (defaults to `localStorage`)               |
| `version`                          | Persisted schema version                                          |
| `migrate(value, persistedVersion)` | Upgrade older payloads                                            |
| `clearOnReset`                     | Remove the entry on reset instead of writing the initial snapshot |
| `allowList` / `blockList`          | Filter which `context` paths get stored                           |
| `serialize` / `deserialize`        | Custom codecs                                                     |
| `onError(error)`                   | Persistence error handler                                         |

## Filtering context

Some context should never hit storage — passwords, card numbers, anything sensitive. `allowList` and
`blockList` take dot-separated paths rooted at `context`:

```ts
createPersistencePlugin({
  key: "journey.checkout",
  allowList: ["profile", "auth", "preferences.theme", "cart.items"],
  blockList: ["auth.password"]
});
```

Here `profile` persists as a full subtree, `auth` persists except `auth.password`, `preferences`
keeps only `theme`, and `cart.items` keeps the whole array. The rules:

- A parent path includes everything beneath it.
- `blockList` wins when a path is in both.
- Arrays filter through their parent key (`cart.items`), not per-index.
- An invalid path entry is reported through `onError` and disables persistence for that machine.

On reload, the stored (filtered) context merges onto the journey's initial context — so fields you
omitted, like `auth.password`, fall back to their initial values.

## Migrating across versions

Bump `version` when your context shape changes, and provide `migrate` to upgrade old payloads:

```ts
createPersistencePlugin({
  key: "journey.checkout",
  version: 2,
  migrate: (value, persistedVersion) => {
    if (persistedVersion === 1) {
      return {
        ...value,
        context: { ...value.context, couponCode: value.context.couponCode ?? null }
      };
    }
    return value;
  }
});
```

## Gotchas

:::warning
If persisted data is missing, malformed, or no longer valid for the current journey shape, hydration
falls back to a safe initial snapshot rather than producing a broken flow. If `migrate` returns
something that can't be coerced into a valid snapshot, that's reported through `onError` (or a dev
warning) and hydration falls back too.
:::

**Reset behavior** depends on what "reset" means for your product: `clearOnReset: true` removes the
stored entry (start clean), while `clearOnReset: false` writes a fresh idle snapshot back (restart
but keep resume-later support).

## Where to next

- [Autosave](/docs/core/autosave) — debounced drafts with a save-status API.
- [Snapshot](/docs/core/snapshot) — the shape being stored and restored.
