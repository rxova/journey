---
id: overview
title: Overview
---

# Overview

Journey is a small, framework-independent runtime for multi-step flows. A journey owns the current
step, context, history, lifecycle status, and async transition state. Your UI reads one immutable
snapshot and drives the machine through a stable set of methods.

## Why a runtime at all {#motivation}

Component-local step state works until branching, async gates, backtracking, lifecycle outcomes, and
observation must agree. Journey keeps those rules in one runtime so every consumer reads the same
committed state and realized path.

## Two journey shapes, one runtime

| Shape  | Factory               | Use it when                                       |
| ------ | --------------------- | ------------------------------------------------- |
| Linear | `createLinearJourney` | Steps normally follow a declared order.           |
| Graph  | `createGraphJourney`  | Events, guards, or branches decide the next step. |

Both factories use the same snapshot/event runtime. The difference is in definition syntax,
navigation rules, and the fields added to their discriminated snapshots.

```ts
import { createLinearJourney } from "@rxova/journey-core";

const checkout = createLinearJourney({
  steps: ["account", "shipping", "review"] as const,
  context: { email: "" }
});

checkout.controls.start();
console.log(checkout.getSnapshot().currentStep?.id); // "account"
```

## The machine surface

The machine object is stable. Changing state lives in `getSnapshot()`.

| Group           | Purpose                                                      |
| --------------- | ------------------------------------------------------------ |
| `controls`      | Start, pause, resume, complete, terminate, or restart a run. |
| `navigate`      | Move by id or through the realized timeline.                 |
| `subscriptions` | Observe selected snapshot values or named lifecycle events.  |
| `context`       | Apply an immutable context update.                           |
| `plugins`       | Access APIs contributed by registered plugins.               |
| `send`          | Dispatch a typed event on graph journeys only.               |

## Design principles

- **Snapshots are the read model.** Context, status, history, async state, metadata, and derived
  fields are read together.
- **Definitions are data.** Linear and graph definitions can be created, tested, and reused before
  a runtime exists.
- **Navigation is explicit.** Reaching a final step does not complete the journey; call
  `machine.controls.complete()` when the product flow is done.
- **Hooks have clear timing.** `onLeave` can block before commit. `onTransition` and `onEnter` run
  after commit.
- **Plugins observe.** They receive a read-only host and add namespaced machine and snapshot data.

## Where to next

- [Quickstart](./getting-started) builds a complete linear journey.
- [Core concepts](./concepts) explains snapshots, events, hooks, and history.
- [Choosing a mode](./usage/) compares linear and graph journeys.
- [How it works](./architecture) follows an event through the shared runtime.
