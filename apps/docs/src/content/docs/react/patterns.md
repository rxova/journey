---
id: patterns
title: React Patterns
sidebar_label: Patterns
---

These patterns keep React rendering predictable while Core remains the source of runtime truth.

## Keep definitions and bundles outside render

Core definitions are pure data and live at module scope. React bundles — linear and graph — live
there too by default, and deliberately so: both factories capture the definition and create their
one standalone machine on the spot. A Provider only distributes `views`; it creates nothing.

Module scope is the recommended home because it makes the machine's lifetime obvious: one machine
per bundle, shared by every Provider and hook, alive for the whole session. The one thing you must
never do is call a factory **in render** without owning the result — a bare
`createLinearJourney(...)` in a component body creates a fresh machine every render. If you need a
machine per component instance, that is a supported pattern with one obligation; see the next
section.

## Own a bundle inside a component

Creating the bundle inside a component is legitimate whenever the journey's lifetime should match
a component instance instead of the module — per-mount wizards, per-request SSR isolation, and
tests. The consumer's job is to guarantee **one stable reference** for the component's lifetime.
Use a `useState` lazy initializer:

```tsx
const SignupWizard = () => {
  const [signup] = React.useState(() =>
    createLinearJourney({ context: { email: "" }, steps: ["email", "review", "done"] })
  );

  return (
    <signup.Provider views={{ email: <Email />, review: <Review />, done: <Done /> }}>
      <signup.StepRenderer />
    </signup.Provider>
  );
};
```

The rules that make this correct:

- **`useState(() => create...)`, not `useRef(create...)`.** The lazy initializer runs once per
  mounted instance. `useRef(createLinearJourney(...))` evaluates its argument on every render (and
  twice under StrictMode's double render), creating machines that are immediately thrown away. If
  you prefer a ref, guard it: `if (ref.current === null) ref.current = create...`.
- **Everything on the bundle closes over that one machine**, so hooks, `navigate`, and
  `updateContext` all work exactly as they do at module scope — the only difference is who owns
  the lifetime.
- **Disposal is optional.** React never disposes a machine, and an unmounted component's machine
  is garbage-collected once nothing references it — the machine holds no global registrations or
  timers at rest. If you do want an explicit `machine.dispose()` on unmount, be aware StrictMode
  runs mount → unmount → mount against the _same_ state value in development: a naive
  `useEffect(() => () => signup.machine.dispose(), [])` kills the machine the second mount reuses.
  Prefer leaving disposal to GC unless a plugin holds external resources.
- **SSR isolation follows for free**: a bundle created during a server render belongs to that
  render, not to the module, so requests no longer share state. This is the isolation path the
  module-scope caveat points at.

## Drive the machine from anywhere

The machine is not a React construct — every method on it (`send`, `navigate.*`, `controls.*`,
`context.update`, `getSnapshot`, `subscriptions.*`) is pre-bound and callable from any code that
can reach the bundle: Redux middleware and reducers' thunks, analytics pipelines, WebSocket
handlers, timers, tests. Extracted references stay valid (`const go = checkout.send; go(...)`).

```ts
// A Redux listener middleware reacting to app state:
listenerMiddleware.startListening({
  actionCreator: paymentAuthorized,
  effect: async () => {
    await checkout.send("continue");
  }
});

// A module-scope subscriber feeding analytics — no React involved:
checkout.machine.subscriptions.subscribeEvent("stepEnter", ({ to }) => {
  analytics.track("checkout step", { step: to });
});

// A test drives the machine directly and asserts on the snapshot:
await checkout.navigate.goToNextStep();
expect(checkout.machine.getSnapshot().currentStep?.id).toBe("review");
```

Listeners fire after the snapshot updates, so `getSnapshot()` inside a listener always sees the
new state.

## Keep `views` stable when the Provider's parent is hot

`views` values are elements, created where you write them. When the Provider's parent re-renders,
an inline `views={{ ... }}` literal is rebuilt, the context value changes, and the active step's
subtree reconciles — correct, but wasted work if the parent renders frequently (a ticking clock,
scroll state). Hoist the record to module scope when the elements need no props from the parent,
or memoize it when they do:

```tsx
const views = React.useMemo(
  () => ({ email: <Email />, review: <Review theme={theme} /> }),
  [theme]
);
```

For the common case — a Provider mounted once near the root — the inline literal is fine; do not
memoize by reflex.

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

For isolation — per mount, per request, or per test — either
[own a bundle inside a component](#own-a-bundle-inside-a-component), or drop a tier lower: a
caller-owned Core machine you create, start, read with `React.useSyncExternalStore`, and
`machine.dispose()` when its owner goes away.

Two server-side caveats worth knowing: a **module-scope** machine is shared across SSR requests
(use one of the isolation paths above when that matters), and a bundle created with the `persist`
option but no explicit `persist.storage` **throws during server render**, because `localStorage`
does not exist there — pass a storage adapter or create that bundle on the client. For Next.js
App Router, `@rxova/journey-react/client` re-exports the main entrypoint from a `"use client"`
boundary, so linear bundles drop into Server Component trees without a boundary file of your own;
the graph entrypoint has no client-marked twin, so put `createGraphJourney` usage behind your own
`"use client"` module.

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
