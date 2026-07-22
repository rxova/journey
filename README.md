# Journey

Typed state machines and React bindings for multi-step product flows.

Most multi-step UI starts as an array and a current index. That works until a flow branches, returns
to an earlier point, performs work before moving, or must explain its state to analytics and
developer tools. Journey keeps those concerns in a small framework-independent machine and exposes
one immutable snapshot as the source of truth.

Journey supports:

- **Linear journeys** whose declared step order is the normal path.
- **Graph journeys** whose named events, synchronous guards, and ordered candidates choose routes.
- **React bindings** — twin linear and graph bundle factories, per-component ownership, and a
  documented pattern for reading a Core machine you own yourself.
- **Plugins** for analytics, autosave, diagnostics, execution paths, persistence, replay, and richer
  subscriptions.
- A [Chrome DevTools extension](https://chromewebstore.google.com/detail/rxova-journey-devtools/bkmdccobpcagbmknjmmhbabcfphinjcm)
  backed by a versioned bridge.

## Packages

| Package                          | Purpose                                         |
| -------------------------------- | ----------------------------------------------- |
| `@rxova/journey-core`            | Framework-independent linear and graph machines |
| `@rxova/journey-react`           | Linear and graph bundle factories for React     |
| `@rxova/journey-devtools-bridge` | Connect a machine to Journey Chrome DevTools    |

```bash
npm install @rxova/journey-core
npm install @rxova/journey-react react
npm install @rxova/journey-devtools-bridge
```

## Core linear journey

Use a linear machine when the declared order is meaningful and most movement is next or previous.

```ts
import { createLinearJourney, type LinearJourneyDefinition } from "@rxova/journey-core";

type StepId = "account" | "shipping" | "review";
type Context = {
  email: string;
  shippingId: string | null;
};

const definition: LinearJourneyDefinition<StepId, Context> = {
  context: {
    email: "",
    shippingId: null
  },
  steps: [
    { id: "account", metadata: { title: "Account" } },
    { id: "shipping", metadata: { title: "Shipping" } },
    { id: "review", metadata: { title: "Review" } }
  ]
};

const checkout = createLinearJourney(definition);
checkout.controls.start();

checkout.context.update((context) => ({
  ...context,
  email: "ada@example.com"
}));

await checkout.navigate.goToNextStep();
```

String steps are shorthand for steps without metadata or lifecycle hooks:

```ts
createLinearJourney({
  context: {},
  steps: ["account", "shipping", "review"]
});
```

Reaching the last linear step does not complete the journey. Position and outcome are separate
concepts, so completion stays explicit:

```ts
checkout.controls.complete({ orderId: "order-42" });
checkout.getSnapshot().machine.outcome;
// { type: "completed", payload: { orderId: "order-42" } }
```

Use `controls.terminate(payload?)` for cancellation or unsuccessful termination.
`controls.restart()` starts a fresh run only after completion or termination.

## Transactional navigation work

Validation and submission often need to finish before the machine moves. Supply navigation work to
next or previous movement:

```ts
const result = await checkout.navigate.goToNextStep({
  run: async ({ snapshot }) => submitShipping(snapshot.context),
  commit: ({ result: shipping, updateContext }) => {
    updateContext((context) => ({
      ...context,
      shippingId: shipping.id
    }));
  }
});

if (!result.ok) {
  console.error(result.reason, result.error);
}
```

`run` is awaited while the source step stays current. If it throws, rejects, or times out, neither
position nor context changes. `commit` is synchronous and its context updates publish atomically
with the destination. This is the place for work that must block movement.

Step `onLeave` and `onEnter` hooks are different: they run after the navigation has committed and
cannot roll it back. They are a good fit for cleanup, analytics, and destination setup.

## Core graph journey

Use a graph when the product speaks in named events and more than one route can leave a step.

```ts
import { createGraphJourney, createGraphJourneyBuilder } from "@rxova/journey-core";

type Event =
  | { type: "continue" }
  | { type: "skip" }
  | { type: "cancel"; payload: { reason: string } };

type StepId = "start" | "details" | "done";

const { createStep, to, build } = createGraphJourneyBuilder<{
  context: { ready: boolean };
  stepId: StepId;
  events: Event;
  meta: { title: string };
}>();

const definition = build({
  initial: "start",
  context: { ready: false },
  steps: [
    createStep("start", {
      metadata: { title: "Start" },
      on: {
        continue: [to("details").when(({ context }) => context.ready)],
        skip: [to("done")]
      }
    }),
    createStep("details", {
      metadata: { title: "Details" },
      on: { continue: [to("done")] }
    }),
    createStep("done", {
      metadata: { title: "Done" }
    })
  ]
});

const machine = createGraphJourney(definition, { autoStart: true });

await machine.send("continue");
await machine.send("cancel", { reason: "user" });
```

Guards are synchronous. Candidate arrays are checked in declaration order and the first enabled
candidate wins. Put asynchronous, pre-commit work in navigation work instead of a guard.

The graph snapshot makes routing inspectable before an event is sent:

```ts
const snapshot = machine.getSnapshot();

snapshot.declaredEvents; // every event declared from this step
snapshot.availableEvents; // events with an enabled candidate
snapshot.availableSteps; // enabled candidate targets
snapshot.outgoingTransitions; // guard, priority, enabled, and selected per candidate
```

## One immutable snapshot

Machine objects contain stable commands. All changing state is published through a new immutable
snapshot:

```ts
const snapshot = machine.getSnapshot();

snapshot.type; // "linear" | "graph"
snapshot.status; // idle | running | paused | completed | terminated
snapshot.context;
snapshot.currentStep?.id;
snapshot.currentStep?.metadata;
snapshot.currentStep?.async;
snapshot.history.timeline;
snapshot.history.currentIndex;
snapshot.history.canGoBack;
snapshot.transition;
snapshot.machine.isLoading;
snapshot.machine.outcome;
snapshot.plugins;
```

Linear snapshots add declared order and index fields. Graph snapshots add event and transition
introspection. Narrow on `snapshot.type` before reading kind-specific fields.

Subscribe to a selected value when a consumer needs one slice, or to a named observation event when
it needs lifecycle detail:

```ts
const stop = machine.subscriptions.subscribeSelector(
  (snapshot) => snapshot.currentStep?.id,
  (stepId) => render(stepId)
);

machine.subscriptions.subscribeEvent("navigationBlocked", ({ reason, error }) =>
  report(reason, error)
);

stop();
```

## Grouped machine commands

The command surface is intentionally grouped:

- `controls.start/pause/resume/complete/terminate/restart` changes lifecycle status.
- `navigate.goToNextStep/goToPreviousStep/goToStepById/goToLastVisitedStep` changes position.
- `context.update` replaces context with the updater result.
- `async.clearError` clears the current entry error.
- Graph machines add typed `send(type, payload?)`.

Every navigation method resolves to `{ ok: true, from, to }` or
`{ ok: false, reason, error? }`. Expected failures do not reject, which makes fire-and-forget
button handlers safe from unhandled promise rejections.

## React: linear bundle

`createLinearJourney` creates one standalone machine and returns a bundle of hooks and components
around it. Step IDs and context are inferred from the definition, so nothing needs generics at the
call site:

```tsx
import { createLinearJourney } from "@rxova/journey-react";

const signup = createLinearJourney({
  name: "signup",
  context: { email: "" },
  steps: ["account", "shipping", "review"]
});

function Footer() {
  const canGoBack = signup.useSelector((snapshot) => snapshot.history.canGoBack);
  const isLoading = signup.useSelector((snapshot) => snapshot.machine.isLoading);

  return (
    <div>
      <button disabled={!canGoBack} onClick={() => void signup.navigate.goToPreviousStep()}>
        Back
      </button>
      <button disabled={isLoading} onClick={() => void signup.navigate.goToNextStep()}>
        Continue
      </button>
    </div>
  );
}

export function Signup() {
  return (
    <signup.Provider views={{ account: <Account />, shipping: <Shipping />, review: <Review /> }}>
      <signup.StepRenderer />
      <Footer />
    </signup.Provider>
  );
}
```

The `views` record is exhaustively type-checked against the step-ID union — a missing or
undeclared key is a compile error. Only `StepRenderer` must render inside the Provider; every
hook closes over the machine and works with or without it, and non-React code drives the same
machine through `signup.machine`, `signup.navigate`, and `signup.updateContext`.

By default the machine starts when the first Provider or hook mounts, not when the factory runs —
that is what makes the first `stepEnter` observable and keeps SSR hydration deterministic. Pass
`{ autoStart: true }` to start eagerly inside the factory, or `{ autoStart: false }` to start it
yourself.

## React: graph bundle

The graph tier is the linear tier's structural twin — same standalone machine, same views-only
Provider, same `StepRenderer` — differing only in its verb, `send` instead of `navigate`:

```tsx
import { createGraphJourney } from "@rxova/journey-react/graph";

const checkout = createGraphJourney(definition);

function Continue() {
  const availableEvents = checkout.useSelector((snapshot) => snapshot.availableEvents);

  return (
    <button
      disabled={!availableEvents.includes("continue")}
      onClick={() => void checkout.send("continue")}
    >
      Continue
    </button>
  );
}

<checkout.Provider views={views}>
  <checkout.StepRenderer fallback={<p>No matching view</p>} />
  <Continue />
</checkout.Provider>;
```

Stable accessors (`useMachine`, `useControls`, `useNavigation`) expose the Core command groups;
plugin APIs stay namespaced on `useMachine().plugins`.

## React: owning a bundle per component

A module-scope bundle is shared by every mount — and, on a server, by every request. When a
journey's lifetime should match a component instance instead, `useJourney` owns it:

```tsx
import { createLinearJourney, useJourney } from "@rxova/journey-react";

function Wizard() {
  const signup = useJourney(() =>
    createLinearJourney({ context: { email: "" }, steps: ["email", "review", "done"] })
  );

  return <signup.Provider views={views}>{/* … */}</signup.Provider>;
}
```

The factory runs once per component instance and the machine is disposed on a real unmount. Do
not reach for a `useState` lazy initializer here: React double-invokes those under StrictMode,
building two fully-configured machines — two plugin setups, two persistence reads and writes, two
armed autosave timers — and abandoning one undisposed.

## React: bring your own machine

There is no headless package entry. When an application already owns a Core machine, React's own
`useSyncExternalStore` is the whole bridge:

```tsx
import React from "react";
import { createLinearJourney } from "@rxova/journey-core";

const machine = createLinearJourney({ context: initialContext, steps }, { autoStart: true });

const subscribe = (onStoreChange: () => void) =>
  machine.subscriptions.subscribeSelector((snapshot) => snapshot, onStoreChange);

function Inspector() {
  const snapshot = React.useSyncExternalStore(subscribe, machine.getSnapshot, machine.getSnapshot);

  return <output>{snapshot.currentStep?.id ?? "Not started"}</output>;
}
```

Snapshots are structurally shared, so identity changes exactly when content does — which is what
makes `getSnapshot` safe to pass directly. The root entry exports the structural types for this
pattern: `AnyJourneyMachine`, `SnapshotOf`, `ContextOf`, `StepIdOf`, and `EventPayloadOf`.

## Plugins

Plugins are imported from dedicated entrypoints. Their APIs remain namespaced on
`machine.plugins`, which prevents collisions and preserves inference:

```ts
import { createReplayPlugin } from "@rxova/journey-core/replay";

const machine = createLinearJourney(definition, {
  plugins: [createReplayPlugin({ maxEntries: 100 })] as const
});

machine.plugins.replay.getReplaySession();
machine.plugins.replay.clearReplaySession();
```

## Chrome DevTools

Attach the machine to the bridge, then inspect it in the Journey panel:

```ts
import { attachJourneyDevtools } from "@rxova/journey-devtools-bridge";

const detach = attachJourneyDevtools(machine, {
  machineId: "checkout",
  label: "Checkout",
  mutationsEnabled: false
});
```

The bridge is enabled by default only outside production. Once explicitly enabled, it permits
mutating operations unless `mutationsEnabled: false` is supplied. The transport uses same-page
`window.postMessage`, so avoid secrets in journey context and snapshots and detach on teardown.

## Documentation and development

Full guides and generated API reference are available at [rxova.org](https://rxova.org/).

```bash
pnpm install
pnpm lint
pnpm packages:typecheck
pnpm test
pnpm examples:verify
pnpm docs:check
```

## License

MIT
