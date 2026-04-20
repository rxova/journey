# @rxova/journey-react

Typed React bindings for multi-step UI flows.

<p>
  <a href="https://www.npmjs.com/package/@rxova/journey-react">
    <img src="https://img.shields.io/npm/v/@rxova/journey-react?color=0f8f6a" alt="npm" />
  </a>
  <img src="https://img.shields.io/badge/1.33%20kB-brotli-0f8f6a" alt="size" />
  <img src="https://img.shields.io/badge/React%2018+-black" alt="React 18+" />
  <img src="https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
</p>

`@rxova/journey-react` is approaching a `1.0.0-rc` contract freeze. The key runtime rule is unchanged:
one `createJourney(...)` call creates one machine instance immediately, and the returned hooks/components stay bound to that instance.

## Install

```bash
npm i @rxova/journey-react @rxova/journey-core
```

Use the root entry for server-safe imports. When a Next.js App Router client boundary should be explicit,
import from `@rxova/journey-react/client`.

## Quickstart

```tsx
import { createJourney, type JourneyViews } from "@rxova/journey-react";
import type { JourneyDefinition } from "@rxova/journey-core";

type StepId = "start" | "review";
type Context = { name: string };

const definition: JourneyDefinition<Context, StepId> = {
  initial: "start",
  context: { name: "" },
  steps: { start: {}, review: {} },
  transitions: {
    start: { goToNextStep: [{ to: "review" }] },
    review: {}
  }
};

const signup = createJourney(definition);

const Start = () => {
  const api = signup.useJourneyApi();
  const snap = signup.useJourneySnapshot();
  return (
    <div>
      <p>Hello, {snap.context.name || "stranger"}</p>
      <button onClick={() => void api.goToNextStep()}>Next</button>
    </div>
  );
};

const Review = () => {
  const api = signup.useJourneyApi();
  return <button onClick={() => void api.completeJourney()}>Submit</button>;
};

const views: JourneyViews<StepId> = { start: Start, review: Review };

export const App = () => (
  <signup.JourneyProvider views={views}>
    <signup.StepRenderer />
  </signup.JourneyProvider>
);
```

## Hooks

`createJourney()` returns a runtime with bound hooks:

- **`useJourneySnapshot()`** — full snapshot: `currentStepId`, `context`, `history`, `status`, `async`
- **`useJourneyApi()`** — runtime commands: `startJourney`, `goToNextStep`, `goToPreviousStep`, `completeJourney`, `send`, etc.
- **`useStepApi(stepId)`** — step-scoped command surface with `send(...)` narrowed to custom events handled by that step or `global`
- **`useJourneyComputed()`** — derived state: `mode`, `activeStepId`, `activeStepIndex`, `visitedStepCount`, `isLoading`, `isIdle`, `isRunning`, `isComplete`, `isTerminated`, `isInitialStep`; linear mode adds `stepCount`, `journeyLength`, `isFirstStep`, `isLastStep`, `stepOrder`
- **`useJourneySelector(selector, eq?)`** — subscribe to a slice of the snapshot
- **`useJourneyEvent(listener)`** — stream lifecycle events for analytics
- **`useJourneyStepLifecycle(stepId, callbacks)`** — run side effects on step enter/leave

## Navigation

```ts
const api = signup.useJourneyApi();

await api.startJourney();
await api.goToNextStep();
await api.goToPreviousStep();
await api.goToLastVisitedStep();
await api.completeJourney();
await api.terminateJourney();
await api.goToStepById("review");

api.updateContext((ctx) => ({ ...ctx, name: "Ada" }));
api.resetJourney();
```

Transition failures resolve through `result.error` instead of rejecting, so `void api.goToNextStep()` is safe from unhandled promise rejections.

For step components, `useStepApi(stepId)` returns the same commands but narrows `send(...)` to custom events handled by that step or by `global` transitions:

```tsx
const api = signup.useStepApi("start");
void api.send({ type: "submit" });
```

## Custom Step Renderer

`StepRenderer` is a convenience — it just looks up the current step's view from the `views` record and renders it. You can build your own if you need transitions, animations, or a different rendering strategy:

```tsx
const MyStepRenderer = () => {
  const { currentStepId } = signup.useJourneySnapshot();
  const View = views[currentStepId];
  if (!View) return <p>Unknown step</p>;
  return <View />;
};
```

## Plugins

```tsx
import { createPersistencePlugin } from "@rxova/journey-core/persistence";

const signup = createJourney(definition, {
  plugins: [createPersistencePlugin({ key: "signup", version: 1 })],
  defaultTimeoutMs: 30_000
});
```

## Runtime Ownership

Each `createJourney()` call creates one machine instance. The returned hooks are permanently bound to it.

- Rendering multiple providers from the same runtime shares one journey state
- `JourneyProvider` auto-starts an `idled` runtime, but does not dispose it by default
- Provider-free flows can start manually through `useJourneyApi().startJourney()` or `machine.startJourney()`
- Provider-owned startup failures are reported through `onError(error, { phase: "start" })`
- Set `disposeOnUnmount` when a provider fully owns a component-scoped runtime
- Independent instances require separate `createJourney()` calls
- `createJourneyFactory()` returns a typed helper for producing fresh runtimes from the same definition/options pair and is the preferred path when request-scoped or boundary-scoped isolation matters
- `dispose()` tears down subscriptions when the runtime is no longer needed

## Documentation

- [Pre-1.0 Migration](https://rxova.org/docs/core/pre-1-0-migration)
- [Stability Contract](https://rxova.org/docs/core/stability)
- [React Quickstart](https://rxova.org/docs/react/quickstart)
- [Provider and Hooks](https://rxova.org/docs/react/provider-and-hooks)
- [Patterns](https://rxova.org/docs/react/patterns)
- [Core Docs](https://rxova.org/docs/core/getting-started)

## License

MIT
