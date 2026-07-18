# @rxova/journey-core

Typed, framework-independent state machines for multi-step product flows.

<p>
  <a href="https://www.npmjs.com/package/@rxova/journey-core">
    <img src="https://img.shields.io/npm/v/@rxova/journey-core?color=0f8f6a" alt="npm" />
  </a>
  <img src="https://img.shields.io/badge/zero%20dependencies-black" alt="zero dependencies" />
  <img src="https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
</p>

Journey owns current position, context, realized history, lifecycle status, terminal outcomes, and
observable async transition state. Linear and graph definitions run on the same small runtime.

## Install

```bash
npm install @rxova/journey-core
```

## Linear quickstart

```ts
import { createLinearJourney } from "@rxova/journey-core";

type CheckoutStepId = "account" | "shipping" | "review";
type CheckoutContext = {
  email: string;
  shippingId: string | null;
};
type CheckoutTerminationPayloads = {
  complete: { orderId: string };
  terminate: { reason: "cancelled" | "expired" };
};

const checkout = createLinearJourney<CheckoutStepId, CheckoutContext, CheckoutTerminationPayloads>({
  steps: [
    { id: "account", metadata: { title: "Account" } },
    { id: "shipping", metadata: { title: "Shipping" } },
    { id: "review", metadata: { title: "Review" } }
  ],
  context: {
    email: "",
    shippingId: null
  }
});

checkout.controls.start();

checkout.context.update((context) => ({
  ...context,
  email: "ada@example.com"
}));

await checkout.navigate.goToNextStep();
```

The first declared step is initial. String steps are shorthand when metadata and hooks are not
needed:

```ts
createLinearJourney({
  steps: ["account", "shipping", "review"],
  context: {}
});
```

The optional third generic groups payloads passed to `controls.complete` and
`controls.terminate`. It also types the corresponding `snapshot.machine.outcome`. Omit it when
terminal payload typing is not needed.

## Transactional navigation

Pass work to next or previous navigation when an operation must succeed before movement:

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

`run` is awaited while the source remains current. If it throws, rejects, or times out, neither
position nor context changes. `commit` is synchronous; its context updates publish atomically with
the destination.

`goToPreviousStep()` accepts the same work contract.

## Async state

Use `snapshot.machine.isLoading` as the normal UI-level loading flag:

```ts
const snapshot = checkout.getSnapshot();
continueButton.disabled = snapshot.machine.isLoading;
```

For diagnostics and richer feedback, `snapshot.transition` identifies the `working`, `leaving`, or
`entering` phase, source, and destination. `snapshot.currentStep.async` records loading, success,
and error state for the current entry.

Only one navigation settles at a time. Concurrent calls resolve with
`{ ok: false, reason: "transitioning" }`.

## Lifecycle effects

`onLeave` and `onEnter` are awaited post-commit effects. They cannot cancel or roll back movement:

```ts
const machine = createLinearJourney({
  context: { receiptId: null as string | null },
  steps: [
    {
      id: "payment",
      onLeave: ({ snapshot }) => analytics.track("payment_left", snapshot.context)
    },
    {
      id: "receipt",
      onEnter: async ({ snapshot, updateContext }) => {
        const receipt = await loadReceipt(snapshot.context);
        updateContext((context) => ({ ...context, receiptId: receipt.id }));
      }
    }
  ]
});
```

Use navigation work for validation or submission that must prevent movement. Use hooks for cleanup,
analytics, and destination setup after the move has committed.

## Navigation and history

```ts
await checkout.navigate.goToNextStep();
await checkout.navigate.goToPreviousStep();
await checkout.navigate.goToPreviousStep(2);
await checkout.navigate.goToLastVisitedStep();
```

Linear history behaves like a browser timeline. Going back preserves the future; appending a new
destination from an older position replaces the abandoned future.

`goToStepById(id)` is an intentional escape hatch for occasional direct jumps in an otherwise
ordered flow:

```ts
await checkout.navigate.goToStepById("review");
```

It is ungated and can reach any declared linear step. When named jumps, branching, or guarded
destinations become normal flow behavior, move the definition to graph mode. The optional
`@rxova/journey-core/convert` entry can convert linear adjacency into graph events.

## Completion and termination

Reaching the last linear step does not complete the machine. A final screen is a position;
completion is an explicit product outcome:

```ts
checkout.controls.complete({ orderId: "order-42" });

checkout.getSnapshot().machine.outcome;
// { type: "completed", payload: { orderId: "order-42" } }
```

Use `controls.terminate(payload?)` for an unsuccessful or cancelled terminal outcome. Navigation is
rejected after either terminal state until `controls.restart()` begins a fresh run.

## Snapshot and subscriptions

All changing state lives in one immutable snapshot:

```ts
const snapshot = checkout.getSnapshot();

snapshot.status; // "idle" | "running" | "paused" | "completed" | "terminated"
snapshot.context;
snapshot.currentStep?.id;
snapshot.currentStep?.index;
snapshot.history.timeline;
snapshot.history.canGoBack;
snapshot.machine.isLoading;
snapshot.machine.outcome;
```

Subscribe to a selected value or a named lifecycle event:

```ts
const stop = checkout.subscriptions.subscribeSelector(
  (snapshot) => snapshot.currentStep?.id,
  (stepId) => render(stepId)
);

checkout.subscriptions.subscribeEvent("navigationBlocked", ({ reason, error }) => {
  reportNavigationFailure(reason, error);
});

stop();
```

## Graph mode

Use `createGraphJourney` when named events, guards, or branches choose destinations. Graph machines
add typed `send(type, payload?)`, available events and targets in the snapshot, and transition-level
post-commit effects.

For larger graphs, `createGraphJourneyBuilder` co-locates typed transitions with each step. See the
[Graph guide](https://rxova.org/docs/core/usage/graph).

## Connectors

Connectors adapt optional third-party libraries to existing Core primitives without attaching a
plugin to the machine. The Immer connector turns a synchronous producer into a context updater:

```bash
pnpm add immer
```

```ts
import { immerConnector } from "@rxova/journey-core/connectors/immer";

machine.context.update(
  immerConnector<CheckoutContext>((draft) => {
    draft.cart.items.push(item);
    draft.cart.total += item.price;
  })
);
```

It also works with the `updateContext` passed to hooks and transactional commits. Immer remains an
optional peer, so consumers that do not import this connector do not install or bundle it. See the
[Immer connector guide](https://rxova.org/docs/core/connectors/immer) for replacement recipes,
freezing, draftability, and transactional behavior.

## Plugins

Built-in plugins are separately imported and observe the machine through a read-only host:

```ts
import { createLinearJourney } from "@rxova/journey-core";
import { createAnalyticsPlugin } from "@rxova/journey-core/analytics";

const machine = createLinearJourney(definition, {
  plugins: [
    createAnalyticsPlugin({
      track: (event) => analytics.track(event.name, event.payload)
    })
  ]
});
```

Persistence, autosave, analytics, diagnostics, replay, execution paths, and subscription enhancer
plugins each have dedicated export paths and documentation.

## Documentation

- [Quickstart](https://rxova.org/docs/core/getting-started)
- [Linear journeys](https://rxova.org/docs/core/usage/linear)
- [Async behavior](https://rxova.org/docs/core/async)
- [Machine API](https://rxova.org/docs/core/api/machine-api)
- [Snapshot](https://rxova.org/docs/core/snapshot)
- [Pre-1.0 migration](https://rxova.org/docs/core/pre-1-0-migration)
- [Stability contract](https://rxova.org/docs/core/stability)

## License

MIT
