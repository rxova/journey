---
id: architecture
title: Architecture
sidebar_label: Architecture
---

This page explains the runtime model.

## Core Model

Journey runtime is based on:

- `steps`: step registry.
- `transitions`: ordered rules (first-match-wins).
- `snapshot`: immutable state projection.

Snapshot navigation uses a timeline pointer:

- `history.timeline`: linear realized path.
- `history.index`: current pointer.
- `currentStepId = history.timeline[history.index]`.

## Why Timeline + Pointer

- Current step is always represented in the path.
- Moving backward/forward is deterministic.
- Forward-after-back can truncate tail safely before appending new path.

## Back Semantics

`send({ type: "back" })` behavior:

1. Try explicit matching back transitions.
2. If none match, fallback to `goToPreviousStep(1)`.

## Separation of Concerns

- `@rxova/journey-core`: state model, transitions, async guards/effects, persistence, observability.
- `@rxova/journey-react`: bindings API for Provider/hooks/renderer.
- `@rxova/journey-devtools-bridge`: runtime bridge for devtools protocol.

## Observability

`subscribeEvent` exposes typed lifecycle telemetry without coupling UI code to internals.
