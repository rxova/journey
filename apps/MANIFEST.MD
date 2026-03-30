# MANIFEST

Rxova Journey exists to model product flows as a graph, not as ad-hoc UI state.

Most wizard libraries work well for strictly linear flows, but complex journeys eventually need branching, guards, async effects, and recovery paths. When that logic leaks into components, state becomes duplicated and behavior becomes hard to reason about.

This project defines a small, declarative runtime that keeps journey logic centralized, typed, and observable.

## Principles

- Graph-first over list-first.
- Single source of truth for navigation state.
- Explicit transitions over implicit component logic.
- Framework-agnostic core with typed bindings on top.
- Predictable runtime invariants.

## Journey Definition

A journey is defined by:

- `steps`: a record keyed by step id.
- `transitions`: declarative rules that connect steps.
- `context`: typed shared state for the flow.
- `initial`: starting step id.

Step ids are inferred as a string union, or provided via generics.

Transitions are immutable declarations with fields like:

- `from`
- `event`
- `to` (when applicable)
- `when` (optional guard)
- `effect` (optional side effect)

Built-in event conventions include:

- `goToNextStep`
- `back`
- `completeJourney`
- `terminateJourney`

## Snapshot Contract

The runtime snapshot is the canonical state:

- `currentStepId`
- `history.timeline`
- `history.index`
- `context`
- `visited`
- `stepMeta`
- `status`
- `async`

Key invariants:

- `currentStepId === history.timeline[history.index]`
- `history.timeline` is never empty while a machine exists
- `history.index` is always clamped to timeline bounds
- `visited` is explicit and deterministic

## Machine Behavior

The machine lifecycle is:

- `running`
- `complete`
- `terminated`

Core capabilities:

- Event dispatch (`send`)
- Direct navigation (`goToStepById`)
- Pointer navigation (`goToPreviousStep`, `goToLastVisitedStep`)
- Context updates (`updateContext`)
- Metadata updates (`updateStepMetadata`)
- Error clearing (`clearStepError`)
- Full reset (`resetJourney`)

Transition matching is deterministic: first valid match wins.

Async behavior is modeled explicitly:

- `idle`
- `evaluating-when`
- `error`

And exposed through `snapshot.async` (`isLoading` + per-step async state).

## History Model

History is first-class:

- Timeline keeps the realized path.
- Pointer can move backward without rewriting past entries.
- Returning to the latest visited step is supported.
- Navigation is reproducible from timeline + index.

## Persistence

Persistence is optional and versioned.

Expected capabilities:

- Configurable storage key.
- Default storage adapter where available.
- Versioned persisted payloads.
- Custom serialize/deserialize.
- Migration hook.
- Error callback.

Invalid persisted data must be coerced safely or ignored in favor of a valid initial snapshot.

## Framework Bindings

Bindings can extend step definitions with framework-specific fields (for example, React `component`) while preserving core machine semantics.

Framework concerns must not change core runtime invariants.

## Mutation Rules

Steps are immutable by definition, except runtime metadata.

Rules:

- Step ids are immutable.
- Structural step shape is immutable at runtime.
- Metadata updates are allowed through explicit APIs.
- Runtime lifecycle data belongs to the machine, not to step definitions.
