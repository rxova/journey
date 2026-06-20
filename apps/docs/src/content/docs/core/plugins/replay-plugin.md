---
title: Replay
sidebar_label: Replay
---

# Replay

The replay plugin records a machine's activity into an in-memory session you can inspect or export.
It's the plugin you want when a bug report needs the exact sequence of snapshots and events that led
somewhere — debugging, QA capture, support tickets, test tooling — without changing how the machine
behaves.

## Install and use

```ts
import { createGraphJourney } from "@rxova/journey-core";
import { createReplayPlugin } from "@rxova/journey-core/replay";

const machine = createGraphJourney(journey, {
  plugins: [createReplayPlugin({ maxEntries: 250 })]
});

await machine.startJourney();

const session = machine.getReplaySession();
const exported = machine.exportReplaySession({ pretty: true });
```

## What you get

```ts
machine.getReplaySession();
machine.clearReplaySession();
machine.exportReplaySession(options);
```

A session is an ordered log with the starting snapshot and a flag for whether it overflowed:

```ts
type JourneyReplaySession = {
  version: 1;
  initialSnapshot: JourneySnapshot | null;
  entries: JourneyReplayEntry[];
  truncated: boolean;
};
```

Entries come in two forms: a `snapshot` entry (a committed snapshot plus its change `reason`) and an
`event` entry (an observation event). Together they reconstruct exactly what happened, in order.

## Options

| Option             | Default | What it does              |
| ------------------ | ------- | ------------------------- |
| `maxEntries`       | `500`   | Ring-buffer size          |
| `captureEvents`    | `true`  | Record observation events |
| `captureSnapshots` | `true`  | Record snapshot entries   |

When the buffer fills, the oldest entries drop and `truncated` flips to `true`.

## Exporting

`exportReplaySession()` returns JSON that's safe to drop into a log or attach to a ticket. The
serializer normalizes the values that JSON usually chokes on:

- `bigint` → string, `undefined` → `null`
- functions and symbols → placeholder strings
- `Date` → ISO text, `Error` → `{ name, message, stack? }`
- circular references → `[circular]`

Pass `pretty: true` for readable local output.

## Gotchas

:::warning
The buffer is bounded. On a long-running session, early entries are dropped once `maxEntries` is hit
(`truncated` tells you when). Size it for the window you actually need to debug, not for an entire
session's lifetime.
:::

`clearReplaySession()` resets the buffer and uses the current snapshot as the new baseline — handy
right before reproducing a bug, so the capture starts clean.

## Where to next

- [Snapshot](/docs/core/snapshot) and [Lifecycle & events](/docs/core/lifecycle) — the two entry types.
- [Diagnostics](/docs/core/plugins/diagnostics-plugin) — structural checks rather than runtime capture.
