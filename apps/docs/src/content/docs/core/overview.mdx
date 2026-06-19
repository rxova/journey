# Overview

Journey is a flow runtime for products that need more than "next" and "back".

It works well when your UI looks like a form or stepper, but the behavior underneath is already a graph — branches, skips, retries, async checks, recovery paths, explicit close behavior, and stable history. The goal is not to force one shape. The goal is to let you model the flow you actually have while keeping the API simple.

:::tip The core promise
Define your flow once. Drive it predictably. Inspect it completely.
:::

## The Problem It Solves

Most flows start small — a few steps, a next button, maybe one validation check.

Then product requirements get real. A step can be skipped. A close action needs confirmation. A network check decides whether the user can continue. The UI still looks like a form, but the behavior underneath is already a graph.

That is where Journey helps. It keeps movement rules in one place, makes the path explicit, and gives you a stable snapshot so you can inspect what happened instead of guessing.

## Three Modes

Pick the one that fits your flow shape. All three share the same runtime, snapshot shape, and navigation API.

| Mode         | Factory                 | When to use                                            |
| ------------ | ----------------------- | ------------------------------------------------------ |
| **Linear**   | `createLinearJourney`   | Fixed step sequence; top-to-bottom progress            |
| **Graph**    | `createGraphJourney`    | Branching, conditional routing, retries, custom events |
| **Headless** | `createHeadlessJourney` | Caller-driven navigation; no transition graph          |

:::info
You can move between modes over time. A linear flow often grows into a graph. A UI-bound flow often benefits from headless runtime boundaries later.
:::

## Design Principles

**Transition-first** — movement rules live in transitions, not scattered across button handlers. That keeps intent visible and reviewable.

**Snapshot-persisted** — runtime state lives in one snapshot: current step, history, context, status, visited state, and async state.

**ID-based** — step ids like `"details"` or `"review"` instead of fragile array positions. Reordering a flow or inserting a branch does not silently break navigation.

**Observable** — snapshot subscriptions for rendering, lifecycle events for telemetry. Each at the right level of detail.

**Async-safe** — async guards are part of the model with explicit phases, timeout support, and per-step error state.

## Under The Hood

### Event Pipeline

Journey processes events through a serialized queue. One event starts, its matching transition resolves, async work settles, the snapshot commits — and only then does the next queued event begin. No overlapping mutations.

![Event Processing Pipeline](/img/journey-event-pipeline.svg)

### Definition vs. Snapshot

The runtime keeps two separate concerns: the static definition (what the flow is) and the live snapshot (where things are now). Definitions stay small and readable; the snapshot is the single authoritative place to inspect current state.

![Definition vs. Snapshot](/img/journey-definition-vs-snapshot.svg)

:::info
Read [Machine Architecture](/docs/core/architecture) for a file-by-file walkthrough of how the runtime is assembled, or [Usage](/docs/core/usage) to see each mode in depth.
:::
