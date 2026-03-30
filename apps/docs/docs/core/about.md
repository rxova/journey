---
id: about
title: About
sidebar_label: About
---

# About

Journey is a headless runtime for product flows that stop being simple the moment real product rules show up.

You can use it for a classic wizard. You can also use it for a graph with branches, loops, explicit recovery paths, and event-driven decisions. That combination matters. Many libraries make linear flows pleasant and graph flows painful, or they make graph modeling possible but too abstract for everyday product work. Journey aims for the middle ground: enough structure to stay predictable, and enough freedom to model the path your product actually has.

## The Problem It Solves

Most flows start small. A few screens. A next button. A previous button. Maybe one validation check.

Then the product gets real. A step can be skipped. A close action needs confirmation. A user can branch to a recovery path. A network check decides whether the flow can continue. The UI still looks like “a wizard”, but the behavior underneath is already a graph.

That is where Journey helps. It keeps the movement rules in one place, makes the path explicit, and gives the runtime a stable snapshot so teams can inspect what happened instead of guessing.

## Wizard And Graph, Without Switching Mental Models

Journey supports two common shapes:

- a wizard, where the user mostly moves through a familiar sequence
- a graph, where the user can branch, revisit, skip, recover, or terminate early

Those are not separate products. They are usually the same product at different levels of complexity.

The value of Journey is that the mental model does not need to change when the flow grows. You still define steps, describe transitions, and send events. The difference is that Journey stays honest about the real structure instead of pretending every path is a straight list.

## IDs Instead Of Indexes

Journey is intentionally id-based.

That means you target stable step ids such as `"details"` or `"review"` instead of fragile array positions. Reordering a flow, inserting a branch, or splitting one step into two does not silently invalidate the meaning of “go to step 3”.

Stable ids are a small design choice with large consequences. They make refactors safer, debugging clearer, and direct navigation easier to reason about.

## Practical Advantages

### Graph-Based

You can model the real flow shape instead of forcing complex behavior into a linear abstraction that breaks down as soon as branching appears.

### Transition-First

Movement rules live in transitions, not in scattered button handlers. That keeps intent visible and reviewable.

### Snapshot-Persisted

Runtime state is captured in one snapshot. Current step, history, context, status, visited state, and async state stay together.

### Observable

Journey exposes both snapshot subscriptions and lifecycle events, so rendering and telemetry can each use the right level of detail.

### Async-Safe

Async guards are part of the model. They are not bolted on afterwards, which makes loading, failure, and timeout behavior easier to explain and test.

## What Journey Tries To Preserve

The main idea is not “more features”. It is keeping flows understandable after they become non-trivial.

A good flow runtime should make it easier to answer questions like these:

- Why did the user land here?
- Which transition matched?
- Was a step skipped on purpose?
- What data was true when the transition ran?
- Did async work fail, time out, or get blocked by a guard?

Journey is built so those questions have concrete answers in the runtime model, not just in application-specific logging.
