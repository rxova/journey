# @rxova/journey-vue

Typed Vue bindings for Rxova Journey.

## Install

```bash
npm i @rxova/journey-vue
```

## API Style

`@rxova/journey-vue` is bindings-first:

- `createJourneyBindings(journey)` returns a typed bundle:
- `Provider`
- `StepRenderer`
- `useJourneyApi`, `useJourneySnapshot`, `useJourneyMachine`

No per-composable generic arguments are needed at callsites.

## Quickstart

```ts
import { defineComponent } from "vue";
import { createJourneyBindings, type JourneyVueDefinition } from "@rxova/journey-vue";

type StepId = "start" | "review";
type Ctx = { name: string };

let bindings: ReturnType<typeof createJourneyBindings<Ctx, StepId>>;

const Start = defineComponent({
  setup() {
    const api = bindings.useJourneyApi();
    const onClick = () => void api.goToNextStep();
    return { onClick };
  },
  template: `<button @click="onClick">Next</button>`
});

const Review = defineComponent({
  setup() {
    const api = bindings.useJourneyApi();
    const onClick = () => void api.completeJourney();
    return { onClick };
  },
  template: `<button @click="onClick">Submit</button>`
});

const journey: JourneyVueDefinition<Ctx, StepId> = {
  initial: "start",
  context: { name: "" },
  steps: {
    start: { component: Start },
    review: { component: Review }
  },
  transitions: [
    { from: "start", event: "goToNextStep", to: "review" },
    { from: "review", event: "completeJourney" }
  ]
};

bindings = createJourneyBindings(journey);

const App = defineComponent({
  components: { Provider: bindings.Provider, StepRenderer: bindings.StepRenderer },
  template: `<Provider><StepRenderer /></Provider>`
});

void App;
```

## Journey API Helpers

From `bindings.useJourneyApi()`:

- `goToNextStep`
- `terminateJourney`
- `completeJourney`
- `send`
- `goToPreviousStep(steps?)`
- `goToLastVisitedStep()`
- `updateContext`
- `updateStepMetadata`
- `clearStepError`, `resetJourney`

Imperative jump is available through `send`:

```ts
await api.send({ type: "goToStepById", stepId: "review" });
```
