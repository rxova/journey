# @rxova/journey-react

React bindings for `@rxova/journey-core`.

The package offers two bundle tiers without changing Core semantics—a linear factory and a graph
factory, deliberate twins around one standalone machine each—plus a bring-your-own-machine
pattern for machines the caller owns.

## Install

```bash
npm install @rxova/journey-react @rxova/journey-core react
```

**React 18.2 and later**, including React 19. The package uses `useSyncExternalStore` to
subscribe to immutable Core snapshots, and CI runs the test suite against both the minimum
supported version and the latest.

One development-only difference: React 18's StrictMode re-mounts hooks on its second render pass,
so `useJourney()`'s factory runs twice there and once on React 19. Only the committed bundle is
ever started, so the discarded one holds no timers, subscriptions, or journey state — but keep
the factory free of side effects beyond building the bundle.

## Linear journeys

```tsx
import { createLinearJourney } from "@rxova/journey-react";

type Context = {
  email: string;
};

const initialContext: Context = { email: "" };

const signup = createLinearJourney({
  name: "signup",
  context: initialContext,
  steps: ["email", "password", "review"]
});

function Controls() {
  const canGoBack = signup.useSelector((snapshot) => snapshot.history.canGoBack);
  const isLoading = signup.useSelector((snapshot) => snapshot.machine.isLoading);

  return (
    <nav>
      <button disabled={!canGoBack} onClick={() => void signup.navigate.goToPreviousStep()}>
        Back
      </button>
      <button disabled={isLoading} onClick={() => void signup.navigate.goToNextStep()}>
        Continue
      </button>
    </nav>
  );
}

export function Signup() {
  return (
    <signup.Provider views={{ email: <Email />, password: <Password />, review: <Review /> }}>
      <signup.StepRenderer />
      <Controls />
    </signup.Provider>
  );
}
```

The factory creates **one standalone machine** at module scope and starts it (`autoStart` defaults
to `true`; runtime options such as `startAt`, `persist`, and `plugins` go in the factory's second
argument). `TContext` is inferred from `definition.context`—annotate the value, do not cast—and
the step-ID union from the `steps` tuple; the `views` record is exhaustively type-checked against
that union. Every hook closes over the machine and works with or without the Provider; non-React
code drives it via `signup.machine`, `signup.navigate`, and `signup.updateContext`. The Provider
carries only `views` and `children`, and `StepRenderer` (optional `fallback`) is the one piece
that must render inside it—siblings like `Controls` are ordinary components.

Hooks: reactive `useSnapshot`, `useSelector`, `useStep` (the current step or `null` while idle),
`useContext`, `useSubscribeEvent`; stable `useMachine`, `useControls`, `useNavigation`; and
`useStepHandler` below.

### Transactional step work

```tsx
function Review() {
  signup.useStepHandler("review", {
    run: ({ snapshot }) => api.submit(snapshot.context),
    commit: ({ result, updateContext }) => {
      updateContext((context) => ({ ...context, receiptId: result.id }));
    }
  });

  return <ReviewForm />;
}
```

`useStepHandler(stepId, handler)` registers work for that step while the component is mounted.
The work runs before forward movement; failure keeps the source step current and lands in
`currentStep.async.error`, while a successful commit publishes its context updates atomically with
movement.

## Graph journeys

```tsx
import { createGraphJourney } from "@rxova/journey-react/graph";

const checkout = createGraphJourney(definition, {
  plugins: [createReplayPlugin()] as const
});

function Continue() {
  const canContinue = checkout.useSelector((snapshot) =>
    snapshot.availableEvents.includes("continue")
  );

  return (
    <button disabled={!canContinue} onClick={() => void checkout.send("continue")}>
      Continue
    </button>
  );
}

<checkout.Provider views={{ cart: <Cart />, shipping: <Shipping />, done: <Done /> }}>
  <checkout.StepRenderer fallback={<p>Missing view</p>} />
  <Continue />
</checkout.Provider>;
```

The graph bundle has the same shape as the linear one—standalone machine, `views` Provider,
`StepRenderer`, reactive `useSnapshot` / `useSelector` / `useStep` / `useContext` /
`useSubscribeEvent`, stable `useMachine` / `useControls` / `useNavigation`—with `send` and
`updateContext` as the verbatim delegates. No hook needs the Provider. Plugin APIs remain
namespaced on `useMachine().plugins`.

In both tiers, all Providers and hooks share the bundle's one machine: state survives remounts,
reset is explicit (`machine.controls.restart()` from a terminal status, `terminate()` first when
mid-flight), and in SSR a module-scope machine is shared across requests.

The machine works everywhere: every method is pre-bound, so Redux middleware, reducers' thunks,
WebSocket handlers, and tests can call `bundle.send`, `bundle.navigate`, `bundle.updateContext`,
or `machine.subscriptions` directly — no React in sight. A bundle driven only from non-React code
needs `{ autoStart: true }`, since nothing ever mounts to start it.

## Starting and stopping

By default the machine starts when the first Provider or hook mounts, not when the factory runs.
That ordering is what makes the journey's first `stepEnter` observable through
`useSubscribeEvent`, and it keeps SSR deterministic — layout effects do not run on the server, so
both sides render `fallback` and hydration matches. `controls.start()` is idempotent, so mounting
many components still starts the journey exactly once.

Pass `{ autoStart: true }` to start eagerly inside the factory (server-rendered step content, or
a bundle driven entirely from non-React code), or `{ autoStart: false }` to start it yourself.

**A module-scope bundle is never disposed.** Its machine, its subscriptions, and any plugin
resources — autosave timers, persistence writers — live for the lifetime of the process. That is
the intended trade-off for a journey that outlives every component; it also means one bundle at
module scope is shared by every request in a server process, so state a request writes is visible
to the next one. Own a bundle per component or per request when that matters.

## Owning a bundle per component

`useJourney()` creates a bundle for one component instance and disposes it on unmount:

```tsx
import { createLinearJourney, useJourney } from "@rxova/journey-react";

function Wizard() {
  const signup = useJourney(() =>
    createLinearJourney({ context: initialContext, steps: ["email", "review", "done"] })
  );
  const step = signup.useStep();
  return <signup.Provider views={views}>{/* … */}</signup.Provider>;
}
```

The factory runs once per component instance. Do not reach for a `useState` lazy initializer
here: React double-invokes those under StrictMode, which builds two fully-configured machines —
two plugin setups, two persistence reads and writes — and abandons one without disposing it.
`useJourney` initializes into a ref and defers disposal by a macrotask, so StrictMode's simulated
unmount cancels it and a real unmount does not.

## Bring your own machine

To drop a tier lower and own a Core machine yourself — no package entry needed, React's
`useSyncExternalStore` is the whole bridge:

```tsx
import React from "react";
import { createLinearJourney } from "@rxova/journey-core";

const machine = createLinearJourney({ context: initialContext, steps }, { autoStart: true });

const subscribe = (onStoreChange: () => void) =>
  machine.subscriptions.subscribeSelector((snapshot) => snapshot, onStoreChange);

function Inspector() {
  const snapshot = React.useSyncExternalStore(subscribe, machine.getSnapshot, machine.getSnapshot);

  React.useEffect(
    () =>
      machine.subscriptions.subscribeEvent("navigationBlocked", ({ reason, error }) => {
        report(reason, error);
      }),
    []
  );

  return <output>{snapshot.currentStep?.id}</output>;
}
```

The caller retains start/dispose ownership. `@rxova/journey-react` exports structural types for
generic adapters: `AnyJourneyMachine`, `SnapshotOf`, `ContextOf`, `StepIdOf`, and
`EventPayloadOf`.

## Async UI

Read `snapshot.machine.isLoading` for the broad loading state, `snapshot.transition` for
phase/source/destination, and `snapshot.currentStep?.async` for the current entry result. Guards
are synchronous; work that must complete before movement belongs in Core navigation work.

## DevTools

The bundle's machine is standalone—attach devtools to it directly in an effect:

```tsx
React.useEffect(() => attachJourneyDevtools(checkout.machine, { enabled: true }), []);
```

Return the bridge detach function, and use `mutationsEnabled: false` for inspect-only sessions.

See the [React documentation](https://rxova.org/docs/react/overview) for complete guides and API
reference.

## License

MIT
