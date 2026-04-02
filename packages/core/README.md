# @rxova/journey-core

Typed state machine for multi-step UI flows.

<p>
  <a href="https://www.npmjs.com/package/@rxova/journey-core">
    <img src="https://img.shields.io/npm/v/@rxova/journey-core?color=0f8f6a" alt="npm" />
  </a>
  <img src="https://img.shields.io/badge/7.13%20kB-brotli-0f8f6a" alt="size" />
  <img src="https://img.shields.io/badge/zero%20dependencies-black" alt="zero deps" />
  <img src="https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
</p>

`@rxova/journey-core` is approaching a `1.0.0-rc` contract freeze. The current public model is:

- JSON-only runtime `context`
- static step `meta`
- transition-side state updates through `updateContext(...)`
- documented lifecycle callbacks and events as the supported extension surface

## Install

```bash
npm i @rxova/journey-core
```

## Quickstart

```ts
import { createJourneyMachine } from "@rxova/journey-core";

const machine = createJourneyMachine({
  initial: "account",
  context: { name: "" },
  steps: { account: {}, details: {}, review: {} },
  transitions: ["account", "details", "review"]
});

machine.start();

await machine.send({ type: "goToNextStep" }); // account → details
await machine.send({ type: "goToNextStep" }); // details → review
await machine.goToPreviousStep(); // review → details

const snap = machine.getSnapshot();
console.log(snap.currentStepId); // "details"
console.log(snap.history.timeline); // ["account", "details"]
console.log(snap.status); // "running"
```

## Three Transition Modes

Reserved step ids: `*`, `global`, `COMPLETE`, and `TERMINATED`. They are used by the runtime and cannot be used as real step names.

### Linear

Array shorthand for sequential flows. Steps can carry synchronous `updateContext` transitions and timeouts.

```ts
transitions: [
  "account",
  {
    step: "details",
    updateContext: ({ context }) => ({ ...context, step: 2 }),
    timeoutMs: 5000
  },
  "payment",
  "review"
];
```

### Graph

Step-keyed transitions with guards, `updateContext`, and branching.

```ts
transitions: {
  login: {
    goToNextStep: [
      { to: "admin", when: ({ context }) => context.role === "admin" },
      { to: "dashboard" }
    ]
  },
  admin: { completeJourney: true },
  dashboard: { completeJourney: true },
  global: { terminateJourney: true }
}
```

#### Graph Builder

For larger flows, `createJourneyBuilder` lets each step declare its own transitions co-located with its component. It compiles to the same `JourneyDefinition` — no new runtime concepts.

```ts
// builder.ts — typed singleton
const { createStep, to, build } = createJourneyBuilder<Context, StepId, EventMap>();

// steps/login.step.ts — co-located with Login.tsx
export const loginStep = createStep("login", {
  on: {
    submit: [to("admin").when(({ context }) => context.role === "admin"), to("dashboard")]
  }
});

// journey.ts — one-screen assembly
const definition = build({
  initial: "login",
  context: { role: "user" },
  steps: [loginStep, adminStep, dashboardStep],
  global: { completeJourney: true, terminateJourney: true }
});
```

Use the **factory form** when you need `event.payload` narrowed to the specific event type:

```ts
submit: ({ to }) => [to("admin").when(({ context, event }) => event.payload?.username !== "")];
```

### Headless

Omit `transitions` entirely. The machine holds state, history, and context, but the caller decides where to go. Useful for custom renderers, server-driven flows, or when the navigation logic lives outside the definition.

```ts
const machine = createJourneyMachine({
  initial: "start",
  context: {},
  steps: { start: {}, configure: {}, confirm: {} }
  // no transitions — the caller drives the flow
});

machine.start();
await machine.goToStepById("configure");
await machine.goToStepById("confirm");
await machine.goToPreviousStep(); // back to configure
await machine.completeJourney();
```

In headless mode, `goToStepById(...)` is the navigation primitive. `goToNextStep()` and custom events are explicit no-ops until you define transitions and move into linear or graph mode.

After `dispose()`, send-style APIs resolve with `transitioned: false` and `error: JourneyDisposedError`. Control APIs such as `start()` and `updateContext()` stay no-op and emit a development warning.

`updateContext()` is the ordered context-write API. It runs through the same queue as `send()`, so it applies against the latest committed snapshot when it executes.

## Step Lifecycle

Run side effects when a step is entered or left by attaching `onEnter` / `onLeave` directly to the step definition. Both callbacks receive the current `context` and are observational. They do not change transition selection or mutate context. Use transition `updateContext` for synchronous state commits that belong to the transition itself.

```ts
const machine = createJourneyMachine({
  context: { username: "" },
  steps: {
    login: {
      onLeave: ({ context }) => analytics.track("login_left", { user: context.username })
    },
    dashboard: {
      onEnter: ({ context }) => analytics.track("dashboard_entered"),
      onLeave: ({ context }) => console.log("leaving dashboard")
    }
  },
  transitions: ["login", "dashboard"]
});
```

With the graph builder, callbacks sit alongside transitions on the step:

```ts
const dashboardStep = createStep("dashboard", {
  onEnter: ({ context }) => analytics.track("dashboard_entered"),
  onLeave: ({ context }) => console.log("leaving dashboard"),
  on: { submit: [to("review")] }
});
```

In React, use `useJourneyStepLifecycle` when the callback needs access to component state or React context:

```tsx
const { useJourneyStepLifecycle } = createJourney(definition);

function Dashboard() {
  useJourneyStepLifecycle("dashboard", {
    onEnter: ({ context }) => analytics.track("dashboard_entered"),
    onLeave: ({ context }) => console.log("leaving dashboard")
  });
  // ...
}
```

The hook always calls the latest version of your callbacks without re-subscribing.

## Features

- **Async guards** — `when` can be async, with per-transition `timeoutMs` and `AbortSignal`-based cancellation. Step async state is tracked in `snapshot.async.byStep[stepId]` (`idle`, `evaluating-when`, `error`)
- **Timeline history** — `goToPreviousStep()`, `goToLastVisitedStep()`, deterministic back/forward. Snapshot exposes `history.timeline` and `history.index` so you always know where the user has been
- **Computed state** — `getComputed()` returns derived flags: `isFirstStep`, `isLastStep`, `isLoading`, `isComplete`, `isTerminated`, `activeStepIndex`, `stepCount`, `mode` (`linear` | `graph` | `headless`)
- **Observability** — `subscribeEvent()` streams typed lifecycle events: `journey.start`, `transition.start`, `transition.success`, `step.enter`, `step.exit`, `journey.completed`, `journey.terminated`, and more
- **Step metadata** — attach typed metadata per step and read it with `getStepMeta(stepId)`. Metadata is definition data, not mutable runtime state
- **Terminal events** — `completeJourney()` and `terminateJourney()` with typed payloads. Once terminal, all navigation no-ops until `resetJourney()`
- **Snapshot** — one object holds everything that changes at runtime: `currentStepId`, `context`, `history`, `visited`, `status` (`idled`, `running`, `completed`, `terminated`), and `async`
- **Global transitions** — cross-cutting handlers via the `global` key, useful for close-confirmation or abort flows

## Persistence

```ts
import { createPersistencePlugin } from "@rxova/journey-core/persistence";

const machine = createJourneyMachine(definition, {
  plugins: [
    createPersistencePlugin({
      key: "checkout",
      version: 2,
      blockList: ["payment.cardNumber"]
    })
  ]
});
```

Versioned snapshot storage with migrations, context allow/block lists, and configurable reset behavior. Defaults to `localStorage` when available.

If `migrate(...)` returns data that no longer matches a valid snapshot, Journey reports the error through `onError` (or a development warning when `onError` is omitted) and falls back to the initial snapshot.

## Autosave

```ts
import { createAutosavePlugin } from "@rxova/journey-core/autosave";

const machine = createJourneyMachine(definition, {
  plugins: [
    createAutosavePlugin({
      key: "checkout-draft",
      debounceMs: 300,
      allowList: ["profile", "shipping"]
    })
  ]
});

await machine.flushAutosave();
```

Autosave adds debounced draft persistence, hydration, `getAutosaveState()`, `flushAutosave()`, and `clearAutosave()` without requiring the persistence plugin as a separate public dependency.

## Analytics

```ts
import { createAnalyticsPlugin } from "@rxova/journey-core/analytics";

const machine = createJourneyMachine(definition, {
  plugins: [
    createAnalyticsPlugin({
      machineId: "checkout",
      track: (event) => analytics.track(event.name, event.payload)
    })
  ]
});
```

Analytics normalizes Journey lifecycle events into a stable event envelope and adds `trackAnalyticsEvent(...)` for custom markers.

## DevTools

```ts
import { attachJourneyDevtools } from "@rxova/journey-devtools-bridge";

const detach = attachJourneyDevtools(machine, { label: "Checkout" });
```

## Documentation

- [Pre-1.0 Migration](https://rxova.org/docs/core/pre-1-0-migration)
- [Stability Contract](https://rxova.org/docs/core/stability)
- [Quickstart](https://rxova.org/docs/core/getting-started)
- [Usage Modes](https://rxova.org/docs/core/usage)
- [Async Lifecycle](https://rxova.org/docs/core/async)
- [Persistence](https://rxova.org/docs/core/persistence)
- [Autosave](https://rxova.org/docs/core/autosave)
- [Analytics Plugin](https://rxova.org/docs/core/plugins/analytics-plugin)
- [Plugins](https://rxova.org/docs/core/plugins/overview)
- [API Reference](https://rxova.org/docs/core/api/overview)

## License

MIT
