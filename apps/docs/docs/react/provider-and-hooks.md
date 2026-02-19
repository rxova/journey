---
title: Provider and Hooks API
sidebar_position: 3
---

React uses bindings-first APIs.

```tsx
const bindings = createJourneyBindings(journey);

<bindings.Provider>
  <bindings.StepRenderer />
</bindings.Provider>;
```

Hooks from bindings:

- `bindings.useJourneyApi()`
- `bindings.useJourneySnapshot()`
- `bindings.useJourneyMachine()`

`useJourneyApi()` includes:

- `goToNextStep`, `terminateJourney`, `completeJourney`, `send`
- `goToPreviousStep(steps?)`
- `goToLastVisitedStep()`
- `updateContext`, `updateStepMetadata`, `updateStepMetadata`
- `clearStepError`, `resetJourney`

Imperative jump is still available through `send`:

```ts
await api.send({ type: "goToStepById", stepId: "review" });
await api.send({ type: "goToStepById", stepId: "review", payload: { source: "link" } });
```

If a hook is used outside `bindings.Provider`, it throws.
