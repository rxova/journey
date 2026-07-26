---
title: "Runtime Reference"
sidebar:
  label: "Overview"
---

Runtime Reference is the user-facing view of how a live Journey machine behaves after creation.

Machine Architecture explains which file owns each responsibility. Runtime Reference explains what those runtime
guarantees mean when you are reading snapshots, subscribing to events, handling async work, or reasoning about
history.

## Section Map

```text
Runtime Reference
├─ Snapshot
│  └─ What is true right now?
├─ Lifecycle
│  └─ What just happened?
├─ Async Behavior
│  └─ How do guards, updateContext, timeouts, and errors behave?
└─ Timeline Navigation
   └─ How does Journey remember where the user actually went?
```

## When To Use These Pages

- Read [Snapshot](./snapshot.md) when you are rendering UI, persisting state, or debugging current runtime
  truth.
- Read [Lifecycle](./lifecycle.md) when you are wiring analytics, logs, or event-driven side channels.
- Read [Async Behavior](./async.md) when guards can wait, fail, or time out, or when you need transition `updateContext` timing rules.
- Read [Timeline Navigation](./history.md) when you need to reason about back behavior, revisits, and
  branch-after-back flows.

## Under The Hood

If you want to connect these runtime guarantees back to implementation, use the matching architecture pages:

- [Runtime Queue](./architecture/runtime.md)
- [Async State](./architecture/async-state.md)
- [Navigation Commits](./architecture/navigation.md)
- [Send Pipeline](./architecture/send.md)
- [Helpers](./architecture/helpers.md)

## Recommended Reading Order

1. Start with [Snapshot](./snapshot.md) because almost every other runtime question refers back to it.
2. Read [Lifecycle](./lifecycle.md) if you care about observation and event ordering.
3. Read [Async Behavior](./async.md) if transitions are not purely synchronous.
4. Read [Timeline Navigation](./history.md) if your product has explicit back, revisit, or branching flows.
