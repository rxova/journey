# Rxova Journey

<p>
  <a href="https://github.com/rxova/journey/actions/workflows/ci.yml">
    <img src="https://github.com/rxova/journey/actions/workflows/ci.yml/badge.svg?branch=main" alt="CI" />
  </a>
  <img src="https://img.shields.io/badge/coverage-%E2%89%A5%2095%25-0f8f6a" alt="coverage >= 95%" />
  <img src="https://img.shields.io/badge/zero%20deps-%E2%9C%93-0f8f6a" alt="zero dependencies" />
  <img src="https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
</p>

Most flow libraries give you a linear array and basic APIs. That is fine. Journey gives you much more: three modes — linear, branching graph, or fully headless — with async guards, declarative context updates, timeline history, a plugin system, and a native [Chrome DevTools Debugger](https://chromewebstore.google.com/detail/rxova-journey-devtools/bkmdccobpcagbmknjmmhbabcfphinjcm). All in a zero-dependency, ≥95% tested coverage, framework-agnostic 7.58 kB core. [→ Documentation](https://rxova.org/)

Journey is a state machine built for multi-step UI flows that actually get complicated. Start with a simple `["step1", "step2", "step3"]` array. Graduate to a branching graph when you need conditional routing. Go fully headless when you need total control. Navigation isn't just forward — Journey tracks a full timeline so users can step back through history and time-travel forward to the last visited step at any point. Add persistence with one plugin, or write your own. The core is vanilla JS — drop it into React, Vue, Svelte, or plain TypeScript without a shim.

The current runtime contract being frozen for the upcoming `1.0.0-rc` line is:

- JSON-only runtime `context`
- static step `meta`
- transition-side state updates through `updateContext(...)`
- explicit React runtime ownership, with `createJourneyFactory()` as the isolation helper

📖 [Read the documentation](https://rxova.org/)

🚀 [Core Quickstart](https://rxova.org/docs/core/getting-started)

⚛️ [React Quickstart](https://rxova.org/docs/react/quickstart)

🔧 [Chrome DevTools](https://rxova.org/docs/devtool/overview)

🧭 [Pre-1.0 Migration](https://rxova.org/docs/core/pre-1-0-migration)

💬 [GitHub Discussions](https://github.com/rxova/journey)

## Packages

| Package                                                                                             | Version                                                                                     | Size                                                      | Description                |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------- | -------------------------- |
| 🤖 [`@rxova/journey-core`](https://www.npmjs.com/package/@rxova/journey-core)                       | ![version](https://img.shields.io/npm/v/@rxova/journey-core?color=0f8f6a&label=)            | ![7.58 kB](https://img.shields.io/badge/7.58%20kB-0f8f6a) | Framework-agnostic runtime |
| ⚛️ [`@rxova/journey-react`](https://www.npmjs.com/package/@rxova/journey-react)                     | ![version](https://img.shields.io/npm/v/@rxova/journey-react?color=0f8f6a&label=)           | ![1.33 kB](https://img.shields.io/badge/1.33%20kB-0f8f6a) | Typed React bindings       |
| 🔍 [`@rxova/journey-devtools-bridge`](https://www.npmjs.com/package/@rxova/journey-devtools-bridge) | ![version](https://img.shields.io/npm/v/@rxova/journey-devtools-bridge?color=0f8f6a&label=) | ![3.2 kB](https://img.shields.io/badge/3.2%20kB-0f8f6a)   | Chrome DevTools bridge     |

Sizes are brotli-compressed with all dependencies.

## Plugins

| Plugin                                                                                              | Size                                                      | Description                                 |
| --------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------- |
| [`@rxova/journey-core/persistence`](https://rxova.org/docs/core/persistence)                        | ![2.68 kB](https://img.shields.io/badge/2.68%20kB-0f8f6a) | Persist and rehydrate journey state         |
| [`@rxova/journey-core/autosave`](https://rxova.org/docs/core/autosave)                              | ![3.06 kB](https://img.shields.io/badge/3.06%20kB-0f8f6a) | Debounced draft persistence and save status |
| [`@rxova/journey-core/analytics`](https://rxova.org/docs/core/plugins/analytics-plugin)             | ![804 B](https://img.shields.io/badge/804%20B-0f8f6a)     | Normalized lifecycle analytics envelopes    |
| [`@rxova/journey-core/replay`](https://rxova.org/docs/core/replay)                                  | ![648 B](https://img.shields.io/badge/648%20B-0f8f6a)     | In-memory replay capture and export         |
| [`@rxova/journey-core/diagnostics`](https://rxova.org/docs/core/plugins/diagnostics-plugin)         | ![2.42 kB](https://img.shields.io/badge/2.42%20kB-0f8f6a) | Structural journey analysis                 |
| [`@rxova/journey-core/execution-paths`](https://rxova.org/docs/core/plugins/execution-paths-plugin) | ![1.79 kB](https://img.shields.io/badge/1.79%20kB-0f8f6a) | Enumerate reachable execution paths         |

Sizes are brotli-compressed with all dependencies.

## Three Ways to Define Transitions

### Linear

A fixed sequence. Use the array shorthand when every step just goes to the next.

```ts
transitions: ["account", "details", "payment", "review"];
```

Steps can carry context updates:

```ts
transitions: [
  "account",
  {
    step: "details",
    updateContext: ({ context }) => ({ ...context, step: 2 })
  },
  "payment",
  "review"
];
```

### Graph

Branching, retries, conditional routing. Keyed by step, then by event.

```ts
transitions: {
  login: {
    goToNextStep: [
      { to: "admin", when: ({ context }) => context.role === "admin" },
      { to: "setup2fa", when: ({ context }) => context.requires2fa },
      { to: "dashboard" }
    ]
  },
  setup2fa: {
    goToNextStep: [{ to: "dashboard" }]
  },
  blocked: {
    retry: [{ to: "login" }]
  }
}
```

#### Graph Builder

For larger flows, `createGraphJourneyBuilder` lets each step declare its own transitions co-located with its component. It compiles to the same `JourneyDefinition` — no new runtime concepts.

```ts
// builder.ts — typed singleton
const { createStep, to, build } = createGraphJourneyBuilder<{
  context: Context;
  stepId: StepId;
  events: EventMap;
}>();

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
  steps: [loginStep, setup2faStep, adminStep, dashboardStep, blockedStep]
});
```

Use the **factory form** when you need `event.payload` narrowed to the specific event type:

```ts
submit: ({ to }) => [to("admin").when(({ context, event }) => event.payload?.username !== "")];
```

Each transition modifier is single-use at the type level. Calling `.when()`, `.updateContext()`,
`.onEnter()`, `.onLeave()`, `.label()`, or `.timeoutMs()` twice on the same builder is a TypeScript
error. If you bypass the type system, runtime keeps the existing last-call-wins behavior.

### Headless

No transitions defined. Full manual control with `goToStepById`.

```ts
const machine = createJourneyMachine({
  initial: "step1",
  context: {},
  steps: { step1: {}, step2: {}, step3: {} }
});

machine.startJourney();
await machine.goToStepById("step3");
```

## Why Journey?

- **Typed step IDs** — invalid step names are compile errors, not runtime bugs
- **Async guards and transition updates** — async checks via `when`, declarative context changes via `updateContext`
- **Timeline history** — deterministic back/forward navigation with `goToPreviousStep()` and `goToLastVisitedStep()`
- **Plugin system** — opt into persistence, autosave, analytics, replay, diagnostics, and execution-path tooling
- **Chrome DevTools** — inspect timeline, state diffs, and send commands in real time
- **Observable** — subscribe to snapshots or lifecycle events for analytics and debugging
- **Zero dependencies** — 7.58 kB brotlied core, tree-shakeable

## React

```tsx
import { createJourney, type JourneyViews } from "@rxova/journey-react";

const signup = createJourney(definition);

const Start = () => {
  const api = signup.useJourneyApi();
  return <button onClick={() => void api.goToNextStep()}>Next</button>;
};

const views: JourneyViews<StepId> = { start: Start, review: Review };

const App = () => (
  <signup.JourneyProvider views={views}>
    <signup.StepRenderer />
  </signup.JourneyProvider>
);
```

`createJourney(...)` creates one machine instance immediately. If you need one runtime per request, route boundary, or owned component boundary, prefer `createJourneyFactory(...)`.

## License

MIT

---

## Learn more

### Machine definition

The first argument to `createJourneyMachine` is the definition object that describes your flow:

```ts
import { createJourneyMachine } from "@rxova/journey-core";

type Context = { name: string; role: "user" | "admin" };
type StepId = "account" | "details" | "review";
type EventMap = { back: { reason: string }; requestClose: { confirmed: boolean } };
type StepMeta = { title: string; icon?: string };

const machine = createJourneyMachine<Context, StepId, EventMap, StepMeta>({
  initial: "account",

  context: { name: "", role: "user" },

  steps: {
    account: { meta: { title: "Account", icon: "user" } },
    details: { meta: { title: "Details" } },
    review: { meta: { title: "Review", icon: "check" } }
  },

  transitions: {
    account: {
      goToNextStep: [{ to: "details" }]
    },
    details: {
      goToNextStep: [{ to: "review", when: ({ context }) => context.name !== "" }],
      back: [{ to: "account" }]
    },
    review: {},
    global: {
      requestClose: [{ to: "account", when: ({ event }) => event.payload.confirmed }]
    }
  }
});
```

| Field         | Type                                    | Required                        | Description                                                                                                                                                                              |
| ------------- | --------------------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `initial`     | `TStepId`                               | Linear: no, Graph/Headless: yes | The starting step. For linear transitions, defaults to the first array element. When provided with linear transitions, the machine starts from that step (useful for resuming mid-flow). |
| `context`     | `TContext`                              | Yes                             | Initial context (your application state).                                                                                                                                                |
| `steps`       | `Record<TStepId, { meta?: TStepMeta }>` | Yes                             | Step registry. Each step can carry optional typed metadata.                                                                                                                              |
| `transitions` | `TStepId[]` \| `object`                 | No                              | Linear array, graph object, or omitted for headless mode.                                                                                                                                |

**Type parameters:**

| Parameter   | Constraint                | Default                | Description                                                                                                                    |
| ----------- | ------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `TContext`  | —                         | —                      | Shape of the machine context.                                                                                                  |
| `TStepId`   | `extends string`          | —                      | Union of all step IDs (inferred from `steps` keys).                                                                            |
| `TEventMap` | `Record<string, unknown>` | `Record<never, never>` | Maps custom event names to their payload types. Payloads are accessible in guards and transition updaters via `event.payload`. |
| `TStepMeta` | —                         | `unknown`              | Type of per-step definition metadata, readable via `machine.getStepMeta(stepId)`.                                              |

### Machine options

`createJourneyMachine` accepts a definition and an optional options object:

```ts
const machine = createJourneyMachine(definition, {
  requireExplicitCompletion: true, // default: false
  defaultTimeoutMs: 5000, // applied to async guards without their own timeout
  plugins: [persistencePlugin]
});
```

| Option                      | Default | Description                                                                                                                                |
| --------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `requireExplicitCompletion` | `false` | When `false`, `goToNextStep()` on the last step auto-completes the journey. Set to `true` to require an explicit `completeJourney()` call. |
| `defaultTimeoutMs`          | —       | Global timeout for async guards. Per-transition `timeoutMs` overrides this. Throws `JourneyTimeoutError` if exceeded.                      |
| `plugins`                   | `[]`    | Array of plugins to register (persistence, execution paths, etc.)                                                                          |

> **Important:** You must call `machine.startJourney()` before sending any events. The machine initializes in `"idled"` status and won't accept navigation until started.

### API

All navigation methods return `Promise<JourneySendResult>`:

```ts
{
  transitioned: boolean;    // did the transition succeed?
  transitionId?: string;    // internal id of the matched transition
  error?: unknown;          // error from a guard or transition updater
  snapshot: JourneySnapshot;
}
```

**Navigation:**

| Method                       | Description                                                      |
| ---------------------------- | ---------------------------------------------------------------- |
| `startJourney()`             | Transition from `"idled"` to `"running"`. Must be called first.  |
| `goToNextStep()`             | Advance to the next step (linear) or evaluate graph transitions. |
| `goToPreviousStep(steps?)`   | Go back N steps in the timeline (default 1).                     |
| `goToLastVisitedStep()`      | Jump forward to the end of the timeline.                         |
| `goToStepById(stepId)`       | Navigate directly to a step by ID.                               |
| `completeJourney(payload?)`  | End the journey with `"completed"` status.                       |
| `terminateJourney(payload?)` | End the journey with `"terminated"` status.                      |
| `resetJourney()`             | Return to the initial step and `"idled"` status.                 |

**State:**

| Method                    | Description                                                                   |
| ------------------------- | ----------------------------------------------------------------------------- |
| `getSnapshot()`           | Current snapshot (step, context, history, async status).                      |
| `getComputed()`           | Derived flags: `mode`, `isFirstStep`, `isLastStep`, `stepCount`, `stepOrder`. |
| `getStepMeta(stepId)`     | Read definition metadata for a specific step.                                 |
| `updateContext(updater)`  | Synchronously update context.                                                 |
| `clearStepError(stepId?)` | Reset async error state for a step.                                           |

**Subscriptions:**

| Method                                       | Description                                                   |
| -------------------------------------------- | ------------------------------------------------------------- |
| `subscribe(listener)`                        | Called on every snapshot change.                              |
| `subscribeSelector(selector, listener, eq?)` | Called when a selected value changes.                         |
| `subscribeEvent(listener)`                   | Observation events (`step.enter`, `transition.success`, etc.) |
| `subscribeStart(listener)`                   | Fires on `journey.start`.                                     |
| `subscribeComplete(listener)`                | Fires on `journey.completed`.                                 |
| `subscribeTerminate(listener)`               | Fires on `journey.terminated`.                                |

### Snapshots

Every snapshot exposes the full state of the machine:

```ts
{
  currentStepId: "payment";
  status: "running";              // "idled" | "running" | "completed" | "terminated"
  context: { ... };
  visited: { account: true, payment: true };
  history: {
    timeline: ["account", "details", "payment"];
    index: 2;
  };
  async: {
    isLoading: false;
    byStep: {
      payment: { phase: "idle", error: null, ... }
    };
  };
}
```

Normal transition flows expose `"idle"`, `"evaluating-when"`, and `"error"` async phases per step.

### Transitions

#### Terminal transitions

Steps can end the journey with `completeJourney` or `terminateJourney`. Use `true` or `[]` as shorthand:

```ts
transitions: {
  review: {
    completeJourney: true,     // shorthand for [{}]
  },
  global: {
    terminateJourney: true,    // available from any step
  }
}
```

Once terminal, the machine ignores further navigation until `resetJourney()` is called.

#### Guards and Context Updates

Transitions support async `when` guards and synchronous `updateContext` updaters:

```ts
goToNextStep: [
  {
    to: "admin",
    when: async ({ context }) => context.role === "admin",
    updateContext: ({ context }) => ({ ...context, welcomed: true }),
    timeoutMs: 3000
  },
  { to: "dashboard" } // fallback if guard fails
];
```

- **Guards** (`when`) — return `true` to allow the transition. They can be async. First match wins.
- **Context updates** (`updateContext`) — run after the guard passes and return the next context.
- **Timeouts** — per-transition `timeoutMs` overrides `defaultTimeoutMs` for async guards. Throws `JourneyTimeoutError`.
- **Errors** — thrown or timed-out guards, and thrown `updateContext` calls, set `snapshot.async.byStep[stepId].error`. A guard that returns `false` just falls through to the next candidate.

#### Global transitions

The `global` key defines transitions available from any step:

```ts
transitions: {
  step1: { goToNextStep: [{ to: "step2" }] },
  global: { requestClose: [{ to: "confirmExit" }] }
}
```

#### Linear auto-completion

In linear mode, calling `goToNextStep()` on the last step automatically completes the journey — unless `requireExplicitCompletion` is set to `true`.

### Plugins

Plugins hook into the machine lifecycle via `setup()`:

```ts
const myPlugin: JourneyMachinePlugin = {
  setup({ journey, resolvedJourney, options, buildInitialSnapshot }) {
    return {
      hydrateSnapshot(snapshot) {
        /* transform initial snapshot */
      },
      onSnapshotChange({ previousSnapshot, snapshot, reason }) {
        /* react to changes */
      },
      augmentMachine({ machine, journey, resolvedJourney }) {
        /* add methods */
      },
      dispose() {
        /* cleanup */
      }
    };
  }
};
```

| Hook               | Description                                                                       |
| ------------------ | --------------------------------------------------------------------------------- |
| `hydrateSnapshot`  | Transform the snapshot before the machine starts (e.g. rehydrate from storage).   |
| `onSnapshotChange` | Called on every snapshot change with `{ previousSnapshot, snapshot, reason }`.    |
| `augmentMachine`   | Extend the machine API with custom methods and access to the resolved definition. |
| `dispose`          | Cleanup when `machine.dispose()` is called.                                       |

#### Built-in: Persistence

Versioned snapshot storage with migrations:

```ts
import { createPersistencePlugin } from "@rxova/journey-core";

const persistence = createPersistencePlugin({
  key: "signup-flow",
  version: 2,
  storage: localStorage, // default, or provide custom { get, set, remove }
  allowList: ["context", "history"], // or blockList
  migrate: (snapshot, version) => {
    /* handle old versions */
  },
  clearOnReset: true
});
```

#### Built-in: Execution Paths

Structural analysis of all reachable paths:

```ts
import { createExecutionPathsPlugin } from "@rxova/journey-core";

const paths = createExecutionPathsPlugin({ maxDepth: 10, maxPaths: 50 });

const machine = createJourneyMachine(definition, { plugins: [paths] });
machine.getExecutionPaths(); // { paths, truncated, cyclesDetected }
```

#### Other built-in plugins

- `@rxova/journey-core/autosave` for debounced draft persistence and save-status APIs
- `@rxova/journey-core/analytics` for normalized lifecycle analytics envelopes
- `@rxova/journey-core/replay` for in-memory replay capture and export
- `@rxova/journey-core/diagnostics` for structural journey analysis
