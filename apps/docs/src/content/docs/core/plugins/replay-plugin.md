---
title: "Replay"
---

Replay records a bounded session of status, transition, context, blocked-navigation, and error
observations.

```ts
import { createReplayPlugin } from "@rxova/journey-core/replay";

const machine = createLinearJourney(definition, {
  plugins: [createReplayPlugin({ maxEntries: 500, captureSnapshots: true })]
});
```

## API

```ts
const replay = machine.plugins.replay;

replay.getReplaySession();
replay.exportReplaySession({ pretty: true });
replay.clearReplaySession();
```

The session contains `startedAt` and a bounded `entries` array. Each entry has `at`, `kind`, `data`,
and, when enabled, a serialized snapshot.

`clearReplaySession()` resets both the entries and session start time. The snapshot extension
exposes `{ entryCount }`.

## Options

| Option             | Meaning                                                       |
| ------------------ | ------------------------------------------------------------- |
| `maxEntries`       | Ring-buffer capacity; default `500`, minimum `1`.             |
| `captureSnapshots` | Attach a serializable snapshot to each entry; default `true`. |
| `now`              | Injectable clock.                                             |

Serialization converts unsupported values to safe representations; use the exported
`toSerializable` and `serializeReplaySession` helpers when building related tooling.

## Where to next

- [Plugins](./overview)
- [Lifecycle and events](../lifecycle)
