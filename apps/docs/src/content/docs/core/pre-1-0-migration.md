---
title: "rc.2 → 1.0 migration"
---

`1.0.0` ships three coordinated majors — `@rxova/journey-core`, `@rxova/journey-react`, and
`@rxova/journey-devtools-bridge` — that together replace the `1.0.0-rc.2` contracts. This is a
breaking API migration, not a compatibility alias: the rc-era runtime, its React runtime-object
API, and bridge protocol v6 were removed. This page is the single guide for all three packages.

## Core: factories

| rc.2                         | 1.0                                                                      |
| ---------------------------- | ------------------------------------------------------------------------ |
| `createJourneyMachine(...)`  | `createLinearJourney(...)` or `createGraphJourney(...)`                  |
| `createLinearJourney(...)`   | `createLinearJourney(...)` (new definition/machine contract)             |
| `createGraphJourney(...)`    | `createGraphJourney(...)` (new definition/machine contract)              |
| `createHeadlessJourney(...)` | Removed — headless is a [usage pattern](./usage/headless), not a factory |
| `createJourneyBuilder(...)`  | `createGraphJourneyBuilder<TypeBag>()`                                   |

There are exactly two machine kinds. Any machine is "headless" until you attach a rendering tier;
the old headless factory's caller-driven jumps map to linear `navigate.goToStepById` /
`goToStepByIndex`.

```ts
// Linear
const machine = createLinearJourney({
  context,
  steps: ["intro", { id: "details", metadata: { title: "Details" } }, "done"] as const
});

// Graph
const machine = createGraphJourney({
  initial: "form",
  context,
  steps: { form: {}, review: {}, done: {} },
  transitions: {
    SUBMIT: { from: "form", to: "review" },
    APPROVE: { from: "review", to: "done" }
  }
});
```

## Core: flat machine → grouped surface

| rc.2                                                                                     | 1.0                                                                                  |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `machine.startJourney()`                                                                 | `machine.controls.start()`                                                           |
| `machine.pauseJourney()` / `resumeJourney()`                                             | `machine.controls.pause()` / `machine.controls.resume()`                             |
| `machine.completeJourney(payload?)`                                                      | `machine.controls.complete(payload?)`                                                |
| `machine.terminateJourney(payload?)`                                                     | `machine.controls.terminate(payload?)`                                               |
| `machine.resetJourney()`                                                                 | `machine.controls.restart()` (terminal statuses only)                                |
| `machine.goToNextStep()`                                                                 | `machine.navigate.goToNextStep(work?)`                                               |
| `machine.goToPreviousStep(n)`                                                            | `machine.navigate.goToPreviousStep(n?, work?)`                                       |
| `machine.goToStepById(id)`                                                               | `machine.navigate.goToStepById(id)`                                                  |
| `machine.goToLastVisitedStep()`                                                          | `machine.navigate.goToLastVisitedStep()`                                             |
| `machine.updateContext(updater)`                                                         | `machine.context.update(updater)`                                                    |
| `machine.clearStepError()`                                                               | `machine.async.clearError()`                                                         |
| `machine.updateStepMetadata(...)`                                                        | Removed — metadata is definition data, read from `snapshot.currentStep.metadata`     |
| `machine.subscribe(listener)`                                                            | `machine.subscriptions.subscribeSelector(...)` or `subscribeEvent(...)`              |
| `machine.subscribeSelector(...)`                                                         | `machine.subscriptions.subscribeSelector(selector, listener, equals?)`               |
| `machine.subscribeEvent(listener)`                                                       | `machine.subscriptions.subscribeEvent(name, listener)`                               |
| `machine.subscribeStart` / `subscribeComplete` / `subscribeTerminate` / `subscribeReset` | [Subscription-enhancer plugin](./plugins/subscription-enhancer-plugin)               |
| `machine.getComputed()`                                                                  | Derived fields in the discriminated snapshot                                         |
| `machine.getStepMeta(stepId)`                                                            | `snapshot.currentStep.metadata` for the current step; the definition for other steps |
| `machine.send({ type, payload })`                                                        | `machine.send(type, payload?)` — graph machines only                                 |

Controls now return booleans (whether the change applied). Navigation and graph `send` return the
`ok`-discriminated `NavigationResult` instead of throwing or silently no-oping.

Lifecycle-filtered subscriptions moved off the base surface deliberately. Attach them via the
plugin when you need them:

```ts
import { createSubscriptionEnhancerPlugin } from "@rxova/journey-core/subscription-enhancer";

const machine = createLinearJourney(definition, {
  plugins: [createSubscriptionEnhancerPlugin()]
});

machine.plugins["subscription-enhancer"].subscribeComplete(({ snapshot }) => save(snapshot));
```

## Core: snapshot changes

| rc.2                           | 1.0                                                                                    |
| ------------------------------ | -------------------------------------------------------------------------------------- |
| `status: "idled"`              | `status: "idle"`, plus the new first-class `"paused"` status                           |
| `async.byStep[stepId]`         | `currentStep.async` — `{ isLoading, isSuccess, isError, error }` for the current entry |
| `history: { timeline, index }` | `history: { timeline, currentIndex, visited, canGoBack, canGoForward }`                |
| `stepMeta`                     | Removed — static metadata at `currentStep.metadata`                                    |
| `currentStepId`                | `currentStep?.id`                                                                      |
| `getComputed()` fields         | First-class snapshot fields, discriminated by `type: "linear" \| "graph"`              |

Narrow `snapshot.type` before reading linear order fields (`currentStep.index`, `isFirstStep`,
`isLastStep`, `steps.stepOrder`) or graph availability fields (`availableEvents`, `availableSteps`,
`outgoingTransitions`).

## Core: step `effect`/`after` → transactional work

The rc.2 transition `effect` object, per-transition `updateContext`, labels, ids, per-transition
timeouts, and delayed `after` transitions are gone.

- Async pre-commit validation belongs in **work**: `run` is awaited first, `commit` stages context
  synchronously, and for graph work-sends the candidates are routed on the staged context and the
  typed `run` result. Failure is all-or-nothing: the machine stays on the source step with context
  unchanged.
- `onLeave`, graph `onTransition`, and `onEnter` are awaited post-commit effects and cannot block.
- There is **no `after()` equivalent in 1.0** — the runtime has no delayed-transition syntax,
  full stop. Timers live app-side (or in work): model the wait as a step and raise a domain event
  when the timer fires.

```ts
// rc.2: after: { 3000: "timeout" }
// 1.0: the timer is application code raising a real event
const waiting = createStep("waiting", {
  onEnter: async ({ raise }) => {
    await delay(3000);
    raise({ type: "TIMED_OUT" });
  },
  on: {
    TIMED_OUT: [to("timeout")]
  }
});
```

Cancel app-side timers from `onLeave` when the step can be exited early.

## Core: options

- `requireExplicitCompletion` is gone — completion is always explicit now.
- `onLifecycleError` is gone — work failures use navigation results, hook failures use the typed
  `error` event, and isolated subscriber failures route through the new `onListenerError` option.
- New options: `startAt`, `persist` (registers the persistence plugin **and restores** a valid
  saved record at the first `start()`; explicit `startAt` wins), `defaultTimeoutMs`,
  `onListenerError`. See the [creation options](./api/overview.md#creation-options).

## React: runtime-object API → twin bundle factories

`@rxova/journey-react` removed `createJourney`, `createJourneyFactory`, the bound runtime object,
`JourneyProvider`, `StepRenderer` (root export), and the legacy hooks (`useJourneySnapshot` root
form, `useJourneyApi`, `useStepApi`, `useJourneyComputed`).

What replaces them is two factories with the same shape — `createLinearJourney` from the root
entry and `createGraphJourney` from `@rxova/journey-react/graph`. Each creates **one standalone
machine** and returns a bundle around it. They differ only in their verb: linear has `navigate`
and `useStepHandler`, graph has `send`.

### Linear tier: a bundle around one machine

```tsx
// rc.2
const journey = createJourney({ steps, context });

<JourneyProvider journey={journey}>
  <StepRenderer views={{ intro: Intro, details: Details }} />
</JourneyProvider>;

const api = useJourneyApi();
api.goToNextStep();
```

```tsx
// 1.0 — the factory is the machine boundary; views are a typed record
import { createLinearJourney } from "@rxova/journey-react";

const signup = createLinearJourney({
  name: "signup",
  context: { name: "" },
  steps: ["intro", { id: "details", metadata: { title: "Details" } }]
});

<signup.Provider views={{ intro: <Intro />, details: <Details /> }}>
  <signup.StepRenderer />
</signup.Provider>;

function Details() {
  const isLoading = signup.useSelector((snapshot) => snapshot.machine.isLoading);
  const isLastStep = signup.useSelector((snapshot) => snapshot.currentStep?.isLastStep);

  return (
    <button disabled={isLoading} onClick={() => void signup.navigate.goToNextStep()}>
      {isLastStep ? "Finish" : "Next"}
    </button>
  );
}
```

Three differences worth calling out, because they change how you structure a flow:

- **Steps are no longer JSX children.** `views` is a `{ [id in StepId]: ReactNode }` record,
  exhaustively type-checked against the step-ID union, so a missing or undeclared key is a compile
  error. Only `StepRenderer` has to render inside the Provider — everything else is an ordinary
  sibling.
- **The bundle's hooks work with or without the Provider**, because they close over the machine
  rather than reading context. Non-React code drives the same machine through `signup.machine`,
  `signup.navigate`, and `signup.updateContext`.
- **`onStepEnter` as a prop is gone.** Subscribe with `signup.useSubscribeEvent("stepEnter", …)`,
  or from outside React with `signup.machine.subscriptions.subscribeEvent`.

The factory's second argument takes core's `JourneyRuntimeOptions` unchanged (`persist`, `plugins`,
`startAt`, `defaultTimeoutMs`, `onListenerError`). `autoStart` is three-way in this tier: omitted
starts the machine when the bundle's first Provider or hook mounts, `true` starts it eagerly inside
the factory, and `false` waits for `controls.start()`. Per-step forward-navigation work moved to
`signup.useStepHandler(stepId, handler)`.

### Graph tier: the same shape with `send`

```tsx
// rc.2
const bindings = createJourneyBindings(journey);
<bindings.Provider>...</bindings.Provider>;
```

```tsx
// 1.0
import { createGraphJourney } from "@rxova/journey-react/graph";

const checkout = createGraphJourney(definition);

<checkout.Provider views={{ form: <Form />, review: <Review />, done: <Done /> }}>
  <checkout.StepRenderer />
</checkout.Provider>;

function Form() {
  const email = checkout.useSelector((snapshot) => snapshot.context.email);

  return <button onClick={() => void checkout.send("SUBMIT", { email })}>Go</button>;
}
```

Reactive hooks are `useSnapshot`, `useSelector`, `useStep`, `useContext`, and `useSubscribeEvent`;
stable accessors are `useMachine`, `useControls`, and `useNavigation`. Plugin APIs stay namespaced
on `useMachine().plugins`.

**Ownership changed here, and it is the easiest thing to get wrong on upgrade.** The factory
creates one machine, not one per Provider mount. All Providers and hooks of a bundle share it,
state survives unmounting, and React never disposes it — reset is explicit via
`controls.terminate()` then `controls.restart()`. Under SSR, a module-scope bundle is shared by
every request in the process.

### Per-component ownership: `useJourney`

When a journey's lifetime should match a component instance instead of the module — per-mount
wizards, per-request isolation, tests — own the bundle:

```tsx
// 1.0
import { createLinearJourney, useJourney } from "@rxova/journey-react";

function Wizard() {
  const signup = useJourney(() => createLinearJourney(definition));
  const step = signup.useStep();

  return <signup.Provider views={views}>{/* … */}</signup.Provider>;
}
```

The factory runs once per mounted instance and the machine is disposed on a real unmount. Do not
substitute a `useState` lazy initializer: React double-invokes those under StrictMode, which builds
two fully-configured machines — two plugin setups, two persistence reads and writes, two armed
autosave timers — and abandons one undisposed.

### Caller-owned machines: no headless entry point

There is no `@rxova/journey-react/headless`. When ownership and rendering must stay separate, own a
Core machine and read it with React's own `useSyncExternalStore` — that is the whole bridge:

```tsx
// 1.0
import React from "react";
import { createLinearJourney } from "@rxova/journey-core";

const machine = createLinearJourney(definition, { autoStart: true });

const subscribe = (onStoreChange: () => void) =>
  machine.subscriptions.subscribeSelector((snapshot) => snapshot, onStoreChange);

function Wizard() {
  const snapshot = React.useSyncExternalStore(subscribe, machine.getSnapshot, machine.getSnapshot);

  return (
    <CurrentStep
      id={snapshot.currentStep?.id}
      onNext={() => void machine.navigate.goToNextStep()}
    />
  );
}
```

Snapshots are structurally shared, so identity changes exactly when content does — which is what
makes `getSnapshot` safe to pass directly. The root entry exports the structural types for this
pattern: `AnyJourneyMachine`, `SnapshotOf`, `ContextOf`, `StepIdOf`, and `EventPayloadOf`. Keep the
`subscribe` reference stable (module scope, or `useCallback`) or `useSyncExternalStore` will
resubscribe on every render.

## Devtools bridge: protocol 6 → 7

- The bridge emits **protocol version 7**. Version 6 invoke envelopes are still accepted (the
  generic invoke shape is identical); version 5 register traffic is tolerated for discovery but
  cannot invoke v7 operations.
- `commandsEnabled` is now `mutationsEnabled` (default `true` whenever the bridge is enabled; set
  `false` for read-only inspection).
- Command-specific envelopes were replaced by **generic operation descriptors** grouped by id
  prefix: `lifecycle.*`, `navigation.*`, `context.patch`, `machine.inspectSnapshot`, and
  `events.send` (added only for graph machines). Custom panels and protocol clients must migrate
  from legacy command envelopes and the old computed snapshot shape to
  `invoke` / `operationResult` / `operationError` envelopes carrying the Core V1 snapshot.
- The `pluginMetadata` option is gone; plugin state travels inside the machine snapshot under
  `snapshot.plugins`.

## Upgrade order

1. Choose linear or graph per flow and migrate the definition shape (the old headless usage maps
   to linear plus direct id navigation).
2. Move machine calls into their 1.0 groups; change graph send syntax to `send(type, payload?)`.
3. Replace old snapshot selectors with the discriminated snapshot shape; rename `idled` checks to
   `idle` and handle the new `paused` status.
4. Move pre-commit async out of transition effects into navigation/send work; move delayed
   transitions into app-side timers raising events.
5. Replace lifecycle-filtered subscriptions with the subscription-enhancer plugin where still
   needed.
6. Migrate React usage tier by tier; delete `JourneyProvider`-era wiring.
7. If you run a custom devtools panel, migrate it to protocol v7 operation envelopes and rename
   `commandsEnabled` to `mutationsEnabled`.
8. Re-test completion, history branching, and persistence restore; completion is never implicit,
   and `persist` now restores by default when a valid record exists.
