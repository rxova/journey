---
id: patterns
title: React Patterns
sidebar_label: Patterns
---

These patterns keep React rendering predictable while Core remains the source of runtime truth.

## Keep definitions outside render

Core definitions are pure data and can live at module scope. React graph bundles can also live at
module scope because `createGraphJourney` captures the definition without creating a machine.
Machines are created per Provider mount.

## Select the smallest useful state

```tsx
const stepId = checkout.useSelector((snapshot) => snapshot.currentStep?.id);

const loading = checkout.useSelector((snapshot) => snapshot.machine.isLoading);
```

Use `useSnapshot()` when a component needs several related fields that should come from one
consistent emission. Use selectors for leaf components to avoid re-rendering on unrelated changes.

## Keep commands grouped

```tsx
const api = checkout.useApi();

api.controls.pause();
await api.navigate.goToPreviousStep();
await api.send("continue");
api.updateContext((context) => ({ ...context, dirty: true }));
```

Lifecycle, position, events, and context are separate concepts. Preserving the Core groups makes
handlers easier to read and prevents accidental semantic shortcuts.

## Use functional context updates

Snapshot context is immutable. Always return the next value:

```tsx
api.updateContext((context) => ({
  ...context,
  email: nextEmail
}));
```

Do not mutate objects read from a snapshot. Plugins, selectors, and concurrent React rendering all
rely on stable immutable values.

## Put blocking work on navigation

Use navigation `run` for validation/submission that must succeed before movement and `commit`
for the context updates that belong to that successful result. Use step hooks for post-commit
cleanup, analytics, and destination setup.

Synchronous graph guards should remain fast and deterministic. They answer routing questions; they
do not perform network work.

## Respect machine ownership

A linear component or graph Provider owns its machine. Do not cache that machine globally or keep it
after unmount. Use hooks for rendering and `machineRef` only for integration boundaries such as
DevTools.

Headless hooks are the opposite: the caller owns the supplied Core machine and decides when it
starts and disposes.

## Model branches as a graph

Avoid adding/removing linear JSX children in response to context. The declared linear order is
frozen for a mount. When context changes the valid path, express it with graph candidates and guards
so routing remains introspectable.

## Handle navigation results deliberately

Expected failures resolve:

```tsx
const result = await api.send("continue");

if (!result.ok) {
  if (result.reason === "no-enabled-transition") {
    showValidationMessage();
  } else if (result.reason === "error") {
    report(result.error);
  }
}
```

Fire-and-forget handlers are safe from rejected promises, but user-facing failures still deserve an
intentional UI response.
