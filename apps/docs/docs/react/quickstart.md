---
title: Quickstart
sidebar_position: 2
---

The React package has **three tiers**, each with its own API:

| Tier         | Import                          | Shape                         | Use it for                           |
| ------------ | ------------------------------- | ----------------------------- | ------------------------------------ |
| **Linear**   | `@rxova/journey-react`          | `<Wizard>` + `useWizard()`    | Step-by-step flows (the 90% case)    |
| **Graph**    | `@rxova/journey-react/graph`    | `createGraphJourney()` bundle | Non-linear, branching flows          |
| **Headless** | `@rxova/journey-react/headless` | machine-argument hooks        | Full control; bring your own machine |

Runtime semantics such as history, observability, persistence, and async behavior come from Core: [Core Overview](/docs/core/overview) and [Core API](/docs/core/api).

## Linear: `<Wizard>`

Steps are just components inside `<Wizard/>`. Every step declares a mandatory unique `id` **on the element** — your components don't declare or receive an `id` prop; it's typed like React's `key` and the wizard strips it before rendering. No factory, no views map, no provider, no dispose — the machine is created when `<Wizard>` mounts (StrictMode-safe) and disposed on unmount.

```tsx
import { Wizard, useWizard } from "@rxova/journey-react";

const App = () => (
  <Wizard context={{ email: "" }} footer={<Nav />}>
    <Email id="email" />
    <Password id="password" />
    <Confirm id="confirm" />
  </Wizard>
);

const Nav = () => {
  const { goToNextStep, goToPreviousStep, isFirstStep, isLastStep, isLoading } = useWizard();
  return (
    <div>
      <button disabled={isFirstStep} onClick={() => void goToPreviousStep()}>
        Back
      </button>
      <button disabled={isLoading} onClick={() => void goToNextStep()}>
        {isLastStep ? "Finish" : "Next"}
      </button>
    </div>
  );
};
```

That is the whole program.

### Shared typed state

Cross-step state is **core context** — typed, part of the snapshot, persisted by `persist`, visible in devtools. Never plain React state:

```tsx
const { context, updateContext } = useWizard<{ email: string }>();
await updateContext((ctx) => ({ ...ctx, email: "a@b.c" }));
```

For fully inferred typing (no generic at call sites), use the `createWizard` bundle:

```tsx
const wizard = createWizard({
  context: { email: "", attempts: 0 },
  steps: { email: Email, password: Password, confirm: Confirm }
});

// wizard.Wizard, wizard.useWizard (fully typed), wizard.useWizardStep,
// wizard.useWizardSelector, wizard.toGraphDefinition
```

### The steps-object form

When you need programmatic control (steps from data, per-step config), pass steps as an object — keys are ids, insertion order is step order:

```tsx
<Wizard
  context={{ email: "" }}
  steps={{
    email: Email,
    verify: { component: Verify, meta: { title: "2FA" }, onEnter: track }
  }}
/>
```

### Intercepting "Next": `useWizardStep`

```tsx
const Password = () => {
  useWizardStep(async ({ context, updateContext }) => {
    const ok = await validatePassword(context.password);
    if (!ok) throw new Error("Invalid password"); // cancels navigation, lands in error
  });
  return <PasswordForm />;
};
```

### Everything `useWizard()` gives you

Position (`activeStepId`, `activeStepIndex`, `stepCount`, `stepIds`, `isFirstStep`, `isLastStep`), visit tracking (`visited`, `isStepFirstTimeVisit`), status (`status`, `isLoading`, `isPaused`, `error`), navigation with the standard names (`goToNextStep`, `goToPreviousStep`, `goToStepById`, `goToStepByIndex`, `goToLastVisitedStep`, `clearStepError`), the machine's lifecycle command group passed through verbatim (`controls.start`, `controls.reset`, `controls.pause`, `controls.resume`, `controls.complete`, `controls.terminate`), shared state (`context`, `updateContext`), metadata (`activeStepMeta`, `getStepMeta`), and escape hatches (`snapshot`, `machine`).

Persistence is one prop: `<Wizard persist={{ key: "signup" }}>…`.

## Graph: `createGraphJourney`

Non-linear flows keep the definition/views separation. No machine is created at module scope — one machine per `<Provider>` mount:

```tsx
import { createGraphJourney } from "@rxova/journey-react/graph";

const checkout = createGraphJourney({
  initial: "cart",
  context: { items: [] },
  steps: { cart: {}, shipping: {}, payment: {}, confirm: {} },
  transitions: {
    cart: { goToNextStep: [{ to: "shipping" }] },
    shipping: {
      goToNextStep: [{ to: "payment", when: ({ context }) => context.items.length > 0 }]
    },
    payment: { goToNextStep: [{ to: "confirm" }] }
  }
});

export const CheckoutFlow = () => (
  <checkout.Provider views={{ cart: Cart, shipping: Shipping, payment: Payment, confirm: Confirm }}>
    <ProgressHeader />
    <checkout.StepRenderer fallback={<Spinner />} />
  </checkout.Provider>
);

const Cart = () => {
  const api = checkout.useApi();
  return <button onClick={() => void api.goToNextStep()}>Continue</button>;
};
```

Bundle hooks: `useSnapshot`, `useComputed`, `useSelector`, `useApi`, `useStepApi(stepId)` (send narrowed to the step's declared events), `useStepAsyncState`, `useEvent`, `useStepLifecycle`, `useMachine`.

## Headless: machine-argument hooks

Create the machine with core and pass it to hooks — it can live in a module, a store, a prop, or be component-owned:

```tsx
import { createHeadlessJourney } from "@rxova/journey-core";
import { useOwnedJourney, useJourneySelector } from "@rxova/journey-react/headless";

function RiskBanner() {
  const machine = useOwnedJourney(() =>
    createHeadlessJourney({
      initial: "watching",
      context: { score: 0 },
      steps: { watching: {}, flagged: {} }
    })
  );
  const phase = useJourneySelector(machine, (s) => s.currentStepId);
  return phase === "flagged" ? (
    <Banner onAck={() => void machine.goToStepById("watching")} />
  ) : null;
}
```

`useOwnedJourney` runs the factory exactly once (StrictMode-safe) and disposes the machine on unmount.

## Migrating linear → graph

Step ids are stable, so persisted state survives the move:

```ts
import { toGraphDefinition, toGraphSnapshot } from "@rxova/journey-core";

const graphDefinition = toGraphDefinition(linearDefinition); // same ids, forward chain
const graphSnapshot = toGraphSnapshot(linearSnapshot); // flips the snapshot family
```

Or from a wizard bundle: `wizard.toGraphDefinition()`.
