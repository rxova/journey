---
id: runtime-reference
title: Runtime Reference
sidebar_label: Overview
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

- Read [Snapshot](/docs/core/snapshot) when you are rendering UI, persisting state, or debugging current runtime
  truth.
- Read [Lifecycle](/docs/core/lifecycle) when you are wiring analytics, logs, or event-driven side channels.
- Read [Async Behavior](/docs/core/async) when guards can wait, fail, or time out, or when you need transition `updateContext` timing rules.
- Read [Timeline Navigation](/docs/core/history) when you need to reason about back behavior, revisits, and
  branch-after-back flows.

## Under The Hood

If you want to connect these runtime guarantees back to implementation, use the matching architecture pages:

- [Runtime Queue](/docs/core/architecture/runtime)
- [Async State](/docs/core/architecture/async-state)
- [Navigation Commits](/docs/core/architecture/navigation)
- [Send Pipeline](/docs/core/architecture/send)
- [Helpers](/docs/core/architecture/helpers)

## Recommended Reading Order

1. Start with [Snapshot](/docs/core/snapshot) because almost every other runtime question refers back to it.
2. Read [Lifecycle](/docs/core/lifecycle) if you care about observation and event ordering.
3. Read [Async Behavior](/docs/core/async) if transitions are not purely synchronous.
4. Read [Timeline Navigation](/docs/core/history) if your product has explicit back, revisit, or branching flows.
