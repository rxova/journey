---
id: patterns
title: React Patterns
sidebar_label: Patterns
---

These patterns keep React rendering predictable while Core remains the source of runtime truth.

## Keep definitions and bundles outside render

Core definitions are pure data and live at module scope. React bundles — linear and graph — live
there too, and deliberately so: both factories capture the definition and create their one
standalone machine on the spot. Never call a bundle factory inside a component; a Provider only
distributes `views`, it creates nothing.

## Select the smallest useful state

```tsx
const stepId = checkout.useSelector((snapshot) => snapshot.currentStep?.id);

const loading = checkout.useSelector((snapshot) => snapshot.machine.isLoading);
```

Use `useSnapshot()` when a component needs several related fields that should come from one
consistent emission. Use selectors for leaf components to avoid re-rendering on unrelated changes.

## Keep commands grouped

```tsx
const controls = checkout.useControls();
const navigate = checkout.useNavigation();

controls.pause();
await navigate.goToPreviousStep();
await checkout.send("continue");
checkout.updateContext((context) => ({ ...context, dirty: true }));
```

Lifecycle, position, events, and context are separate concepts. Preserving the Core groups makes
handlers easier to read and prevents accidental semantic shortcuts.

## Use functional context updates

Snapshot context is immutable. Always return the next value:

```tsx
checkout.updateContext((context) => ({
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

Both bundles are machine-first: the factory creates one standalone machine that React never
disposes. `bundle.machine` is the integration boundary — DevTools, module-scope subscribers, and
non-React callers all use it directly. State survives unmounts and remounts, so reset explicitly:
`controls.restart()` from a terminal status, `terminate()` first when mid-flight.

A caller-owned Core machine is the isolation path — per mount, per request, or per test. You
create it, start it, read it with `React.useSyncExternalStore`, and call `machine.dispose()` when
its owner goes away.

## Model branches as a graph

Avoid deriving the step list or the `views` record from context. The linear order is fixed in the
definition, and `views` must stay exhaustive over the declared ids. When context changes the valid
path, express it with graph candidates and guards so routing remains introspectable.

## Handle navigation results deliberately

Expected failures resolve:

```tsx
const result = await checkout.send("continue");

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
