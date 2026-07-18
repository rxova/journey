# @rxova/journey-react

React bindings for `@rxova/journey-core`.

The package offers three integration levels without changing Core semantics: a declarative linear
component, Provider-owned graph bundles, and machine-argument headless hooks.

## Install

```bash
npm install @rxova/journey-react @rxova/journey-core react
```

React 19 is supported. The package uses `useSyncExternalStore` to subscribe to immutable Core
snapshots.

## Declarative linear journeys

```tsx
import { LinearJourney, useLinearJourney } from "@rxova/journey-react";

type Context = {
  email: string;
};

function Controls() {
  const journey = useLinearJourney<Context>();

  return (
    <nav>
      <button
        disabled={!journey.snapshot.history.canGoBack}
        onClick={() => void journey.goToPreviousStep()}
      >
        Back
      </button>
      <button disabled={journey.isLoading} onClick={() => void journey.goToNextStep()}>
        Continue
      </button>
    </nav>
  );
}

export function Signup() {
  return (
    <LinearJourney
      context={{ email: "" }}
      footer={<Controls />}
      onComplete={({ context }) => submit(context)}
    >
      <Email id="email" />
      <Password id="password" />
      <Review id="review" />
    </LinearJourney>
  );
}
```

The mounted component owns one Core linear machine. It derives the declared order from direct child
IDs, starts the machine, renders the active child, and disposes the machine on unmount. The child ID
list remains fixed for the mount.

`useLinearJourney()` provides position, visit tracking, status, loading/error state, navigation,
lifecycle `controls`, context updates, metadata, the immutable snapshot, and the underlying
machine.

### Transactional step work

```tsx
function Review() {
  useLinearJourneyStep({
    run: ({ snapshot }) => api.submit(snapshot.context),
    commit: ({ result, updateContext }) => {
      updateContext((context) => ({ ...context, receiptId: result.id }));
    }
  });

  return <ReviewForm />;
}
```

Step work runs before forward movement. Failure keeps the source step current; a successful commit
publishes its context updates atomically with movement.

### Typed bundles

```ts
const signup = createLinearJourney<Context>()(["email", "password", "review"] as const);
```

Use `signup.LinearJourney`, `signup.useLinearJourney()`,
`signup.useLinearJourneySelector()`, and `signup.useLinearJourneyStep()`. The literal tuple
preserves the step-ID union. The bundle creates no machine until its component mounts.

## Graph journeys

```tsx
import { createGraphJourney } from "@rxova/journey-react/graph";

const checkout = createGraphJourney(definition, {
  plugins: [createReplayPlugin()] as const
});

function Continue() {
  const snapshot = checkout.useSnapshot();
  const api = checkout.useApi();

  return (
    <button
      disabled={!snapshot.availableEvents.includes("continue")}
      onClick={() => void api.send("continue")}
    >
      Continue
    </button>
  );
}

<checkout.Provider views={{ cart: Cart, shipping: Shipping, done: Done }}>
  <checkout.StepRenderer fallback={<p>Missing view</p>} />
  <Continue />
</checkout.Provider>;
```

Each Provider mount owns an independent Core graph machine. Bundle hooks must run under that
Provider. Available hooks are `useSnapshot`, `useSelector`, `useApi`,
`useStepAsyncState`, `useEvent`, `useStepLifecycle`, and `useMachine`.

`useApi()` returns the machine's grouped `controls` and `navigate` objects, typed `send`, and
`updateContext`. Plugin APIs remain namespaced on `useMachine().plugins`.

## Headless hooks

Use an existing Core machine without a Journey Provider:

```tsx
import { useJourneyEvent, useJourneySnapshot } from "@rxova/journey-react/headless";

function Inspector({ machine }) {
  const snapshot = useJourneySnapshot(machine);

  useJourneyEvent(machine, "navigationBlocked", ({ reason, error }) => {
    report(reason, error);
  });

  return <output>{snapshot.currentStep?.id}</output>;
}
```

Also available: `useJourneySelector`, `useJourneyStepLifecycle`,
`useStepAsyncState`, and `useOwnedJourney`. Every headless hook takes the machine as its first
argument. Except for `useOwnedJourney`, the caller retains start/dispose ownership.

## Async UI

Read `snapshot.machine.isLoading` for the broad loading state,
`snapshot.transition` for phase/source/destination, and `snapshot.currentStep.async` for the
current entry result. Guards are synchronous; work that must complete before movement belongs in
Core navigation work.

## DevTools

Provider-owned machines are available through `machineRef`:

```tsx
<checkout.Provider views={views} machineRef={setMachine}>
  <checkout.StepRenderer />
</checkout.Provider>
```

Attach that machine in an effect, return the bridge detach function, and use
`mutationsEnabled: false` for inspect-only sessions.

See the [React documentation](https://rxova.org/docs/react/overview) for complete guides and API
reference.

## License

MIT
