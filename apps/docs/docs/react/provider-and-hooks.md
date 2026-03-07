---
title: Provider and Hooks API
sidebar_position: 3
---

React bindings are the UI-facing wrapper for the core machine.

Use this page for React integration details.
Use Core docs for runtime semantics: [Core API](/docs/core/api) and [Core Lifecycle](/docs/core/lifecycle).

## Provider + StepRenderer

```tsx
const bindings = createJourneyBindings(journey);

<bindings.Provider>
  <bindings.StepRenderer />
</bindings.Provider>;
```

- `Provider` creates/hosts machine state for the bound journey.
- `StepRenderer` renders the current step's `component`.

## Hooks and Responsibilities

- `bindings.useJourneySnapshot()`
  - Read-only runtime state for rendering.
  - Use when UI depends on current step/context/status/async phase.

- `bindings.useJourneySelector(selector, equalityFn?)`
  - Read only the selected part of snapshot state.
  - Use when you want to avoid rerenders from unrelated snapshot updates.

- `bindings.useJourneyEvent(listener)`
  - Subscribe to typed lifecycle/telemetry events.
  - Use when you need event stream behavior (analytics, tracing, logs) without manual machine wiring.

- `bindings.useJourneyApi()`
  - Safe action surface for UI controls.
  - Includes navigation helpers, event `send`, context/metadata updates, reset and error clear.

- `bindings.useJourneyMachine()`
  - Direct machine access.
  - Use when you need lower-level APIs like subscriptions or bridge integrations.

## `useJourneyApi()` Surface

Common methods:

- `goToNextStep`, `goToPreviousStep(steps?)`, `goToLastVisitedStep`
- `completeJourney`, `terminateJourney`, `send`
- `updateContext`, `updateStepMetadata`
- `clearStepError`, `resetJourney`

Imperative jump remains available through `send`:

```ts
await api.send({ type: "goToStepById", stepId: "review" });
await api.send({ type: "goToStepById", stepId: "review", payload: { source: "link" } });
```

`updateContext` follows core timing semantics. It updates the visible snapshot immediately, but it does not re-run an async transition already in `evaluating-when` or `running-effect`, and a running effect can later commit over that update. If the change must affect the current transition, apply it before `send(...)` or await the transition first. See [Core Async Behavior](/docs/core/async).

## External Machine Injection

Use `Provider` with `machine` prop when machine ownership lives outside React (for example, shared orchestration or bridge setup).

## Guardrail

If any Journey hook runs outside `bindings.Provider`, it throws immediately.

That fail-fast behavior avoids silent desync bugs.

## Important Boundary

Even when called from React hooks, transition ordering, async phase handling, observability events, history behavior, and persistence are all defined by Core.

Reference pages:

- [Core Snapshot](/docs/core/snapshot)
- [Core Lifecycle](/docs/core/lifecycle)
- [Core Async Behavior](/docs/core/async)
- [Core Timeline Navigation](/docs/core/history)
- [Core Persistence](/docs/core/persistence)
