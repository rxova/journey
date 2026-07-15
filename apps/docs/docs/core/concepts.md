---
id: concepts
title: Core concepts
---

# Core concepts

## Definition and machine

A definition describes steps, initial context, hooks, and, for graph journeys, transitions. A
factory validates and normalizes that definition, then creates a live machine.

```ts
const machine = createLinearJourney({
  steps: ["profile", "confirm"] as const,
  context: { name: "" }
});
```

The machine's methods remain stable for its lifetime. Runtime values are read from snapshots.

## Steps and metadata

Every step has an id. A full step config can add static `metadata`, `onLeave`, and `onEnter`.

```ts
{
  id: "profile",
  metadata: { title: "Your profile" },
  onLeave: ({ snapshot }) => analytics.track("profile_left", snapshot.context)
}
```

Metadata is definition data. The current step exposes it at `snapshot.currentStep.metadata`.

## Context

Context is application data that changes during a run. Replace it immutably through the machine or
the hook-local updater:

```ts
machine.context.update((context) => ({ ...context, name: "Ada" }));

// Inside onLeave, onEnter, or onTransition:
updateContext((context) => ({ ...context, submitted: true }));
```

Hook updates apply immediately after navigation has committed. Navigation-work updates are staged
separately and publish atomically with the move.

## Events and transitions

Graph journeys declare events as a discriminated union and transitions as an event-keyed map.

```ts
type Event =
  | { type: "SAVE"; payload: { draftId: string } }
  | { type: "CANCEL" };

transitions: {
  SAVE: { from: "edit", to: "review" },
  CANCEL: { from: "edit", to: "done" }
}
```

Send an event with `machine.send("SAVE", { draftId: "d1" })`. Linear machines do not have `send`.

## Guards

A graph transition's `when` guard is a synchronous, pure predicate over context and injected
handlers. Guards are evaluated both during sends and during graph snapshot derivation.

```ts
when: ({ context, handlers }) => context.accepted && handlers.isAllowed();
```

For caller-driven next/previous movement, pass asynchronous validation as navigation work.

## Hooks

The runtime has one transactional work point and three effect points:

| Work/effect               | Timing               | Can block? | Available on      |
| ------------------------- | -------------------- | ---------- | ----------------- |
| Navigation `run`/`commit` | Before commit        | Yes        | Next and previous |
| Step `onLeave`            | After commit         | No         | Linear and graph  |
| Transition `onTransition` | After `onLeave`      | No         | Graph             |
| Step `onEnter`            | After `onTransition` | No         | Linear and graph  |

Hook arguments include `snapshot`, `from`, `to`, `event`, `updateContext`, and `raise`. `event` is
`null` for linear and timeline moves. `raise` queues graph events after the current move settles.

## Snapshot

A snapshot is an immutable, internally consistent read model:

```ts
const snapshot = machine.getSnapshot();

snapshot.status;
snapshot.context;
snapshot.currentStep;
snapshot.transition;
snapshot.history;
snapshot.machine;
snapshot.plugins;
```

`snapshot.type` is either `"linear"` or `"graph"` and narrows shape-specific fields.

## History

History is a browser-like timeline plus a pointer:

- `timeline` contains the realized path;
- `currentIndex` points at the active timeline entry;
- `visited` records whether each step has ever been entered in this run;
- `canGoBack` and `canGoForward` are derived from the pointer.

Moving back does not erase the future. Appending a new destination while behind the tip creates a
new branch and drops the abandoned future.

## Status and outcome

| Status       | Meaning                                        |
| ------------ | ---------------------------------------------- |
| `idle`       | Created but not started.                       |
| `running`    | Navigation and graph sends are accepted.       |
| `paused`     | State is retained, but navigation is rejected. |
| `completed`  | Explicitly completed.                          |
| `terminated` | Explicitly terminated.                         |

Completion and termination set `snapshot.machine.outcome`. Only `restart()` starts a fresh run from
a terminal status.

## Plugins

Plugins observe the runtime and contribute namespaced extensions:

```ts
machine.plugins.replay.getReplaySession();
machine.getSnapshot().plugins.replay;
```

They cannot intercept or rewrite navigation in V1.

## Where to next

- [Snapshot](./snapshot)
- [Lifecycle and events](./lifecycle)
- [How it works](./architecture)
