---
title: Architecture and Design
sidebar_position: 2
---

This page explains how Journey is designed and why the model scales better than index-based wizards.

## Core Model

Journey uses a graph model:

- `steps`: named states of the flow.
- `transitions`: ordered edges between steps.
- `context`: mutable business state.
- `history`: navigation memory for deterministic back behavior.

The runtime chooses the **first matching transition** for each event.

## Why Graphs Instead of Step Indexes

Index-driven steppers are easy at first (`currentStep++`), but become brittle when you need:

- conditional skips
- branch-specific back behavior
- close confirmation gates
- async validation before navigation
- deep links or programmatic jumps

Graph transitions keep all navigation rules in one place instead of scattering them across UI handlers.

## Package Boundaries

- `@rxova/journey-core`: headless runtime (framework-agnostic).
- `@rxova/journey-react`: React bindings (`JourneyProvider`, hooks, renderer).

Recommended boundary:

- Business flow rules live in Core definitions.
- Components call API helpers (`next`, `back`, `submit`, `goTo`).

## Runtime Guarantees

- Event processing is queued and deterministic.
- Transition matching is ordered and predictable.
- Async failures are surfaced in `send(...)` and tracked in step async state.
- Terminal states (`COMPLETE`/`CLOSE`) lock transitions until `reset()`.

## Comparison Matrix

| Area            | Journey                                         | Typical index-based wizards        |
| --------------- | ----------------------------------------------- | ---------------------------------- |
| Flow model      | Graph (`steps` + ordered `transitions`)         | Step index + imperative branching  |
| Branching/skip  | First-class via `when` guards                   | Usually component-level `if` logic |
| Back behavior   | Deterministic via `HISTORY_TARGET`              | Manual history/index bookkeeping   |
| Async lifecycle | Built-in async phases and step-level errors     | Usually ad-hoc loading/error flags |
| Durability      | Optional persistence + migration hooks          | Custom storage logic per project   |
| Framework split | Headless core + React bindings                  | Often UI-coupled runtime           |
| Type safety     | Strong typing for events/steps/context/payloads | Frequently looser typing           |
| Queue semantics | Serialized sends with failure resilience        | Race handling left to consumers    |

## Lifecycle Surface

The machine exposes explicit async/runtime state:

- `snapshot.async.isLoading`
- `snapshot.async.byStep[stepId].phase`
- `snapshot.async.byStep[stepId].error`

This enables reliable UX for loading/error views without ad-hoc flags.

## Durability and Recovery

Journey supports:

- bounded history with overflow callbacks
- optional persistence adapters
- versioned migrations
- configurable reset persistence behavior

See:

- `/docs/core/history`
- `/docs/core/persistence`

## Recommended Build Workflow

1. Model transitions in Core.
2. Write tests around transition behavior.
3. Integrate with React using provider/hooks.
4. Add persistence/history constraints after behavior is stable.

## Tradeoffs

Journey is intentionally focused on stateful flow orchestration. It is not:

- a URL router
- a full workflow BPM engine
- a visual flow editor

It solves step-based product flows where deterministic navigation and typed context matter.
