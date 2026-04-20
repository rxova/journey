---
title: Replay Plugin
sidebar_label: Replay Plugin
---

# Replay Plugin

The replay plugin records machine activity into an in-memory session you can inspect or export.

It is useful for debugging, QA capture, support tickets, and test tooling where you want to preserve the order of runtime snapshots and lifecycle events without changing machine behavior.

## Install And Use

```ts
import { createJourneyMachine } from "@rxova/journey-core";
import { createReplayPlugin } from "@rxova/journey-core/replay";

const machine = createJourneyMachine(journey, {
  plugins: [
    createReplayPlugin({
      maxEntries: 250
    })
  ]
});

await machine.startJourney();

const session = machine.getReplaySession();
const exported = machine.exportReplaySession({ pretty: true });
```

## What You Get

The plugin augments the machine with:

```ts
machine.getReplaySession();
machine.clearReplaySession();
machine.exportReplaySession(options);
```

`getReplaySession()` returns:

```ts
type JourneyReplaySession = {
  version: 1;
  initialSnapshot: JourneySnapshot | null;
  entries: JourneyReplayEntry[];
  truncated: boolean;
};
```

Entries are ordered and come in two forms:

- `snapshot`: a committed snapshot plus the snapshot-change `reason`
- `event`: an observation event emitted by the machine

## Options

- `maxEntries`: replay buffer size, default `500`
- `captureEvents`: include observation events, default `true`
- `captureSnapshots`: include snapshot entries, default `true`

When the buffer fills, the oldest entries are dropped and `truncated` becomes `true`.

## Runtime Behavior

- `hydrateSnapshot(...)` captures the starting snapshot as `initialSnapshot`
- later snapshot commits are recorded when `captureSnapshots` is enabled
- lifecycle events are recorded through `subscribeEvent(...)` when `captureEvents` is enabled
- `clearReplaySession()` resets the buffer and uses the current machine snapshot as the new replay baseline

## Export Behavior

`exportReplaySession()` returns JSON safe for logs or attachment workflows.

The serializer normalizes values that are awkward or invalid in JSON:

- `bigint` becomes a string
- `undefined` becomes `null`
- functions and symbols become placeholder strings
- `Date` becomes ISO text
- `Error` becomes a plain object with `name`, `message`, and optional `stack`
- circular references are replaced with `[circular]`

Use `pretty: true` when you want readable output for local debugging.
