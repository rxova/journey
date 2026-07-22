---
id: examples
title: React Examples
sidebar_label: Examples
---

The repository's `examples/` workspace contains runnable Vite applications for every supported
React surface.

## Showcase applications

- `react-showcase-linear` demonstrates the standalone linear bundle: a `views` record with
  `StepRenderer` inside a Shell, typed bundle hooks and step handlers, module-scope event
  observers, and DevTools attached straight to `journey.machine`.
- `react-showcase-graph` demonstrates a standalone graph bundle machine, typed domain events,
  synchronous route guards, graph snapshot introspection, and DevTools attached straight to
  `journey.machine`.
- `react-showcase-headless` demonstrates a caller-owned Core machine consumed with React's own
  `useSyncExternalStore` — no React package surface involved.

Run an example from the repository root:

```bash
pnpm --filter examples-react-showcase-graph dev
```

## Plugin applications

The six `react-plugin-*` examples create fully typed Core machines and consume them with the
caller-owned `useSyncExternalStore` pattern, typed via the structural helpers from
`@rxova/journey-react`. They demonstrate exact event payloads and namespaced `machine.plugins`
APIs for analytics, autosave, diagnostics, execution paths, persistence, and replay.

For example:

```tsx
import type { AnyJourneyMachine, SnapshotOf } from "@rxova/journey-react";

const useJourneySnapshot = <TMachine extends AnyJourneyMachine>(
  machine: TMachine
): SnapshotOf<TMachine> => {
  const subscribe = React.useCallback(
    (onStoreChange: () => void) =>
      machine.subscriptions.subscribeSelector((snapshot) => snapshot, onStoreChange),
    [machine]
  );
  const getSnapshot = React.useCallback(
    () => machine.getSnapshot() as SnapshotOf<TMachine>,
    [machine]
  );
  return React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
};

machine.plugins.replay.getReplaySession();
machine.plugins.autosave.flushAutosave();
```

## Minimal graph controls

```tsx
function Controls() {
  const snapshot = checkout.useSnapshot();
  const navigate = checkout.useNavigation();

  return (
    <>
      <button
        disabled={!snapshot.history.canGoBack}
        onClick={() => void navigate.goToPreviousStep()}
      >
        Back
      </button>
      <button
        disabled={!snapshot.availableEvents.includes("continue")}
        onClick={() => void checkout.send("continue")}
      >
        Continue
      </button>
    </>
  );
}
```

## Minimal caller-owned panel

```tsx
import { machine } from "./machine"; // a module-scope Core machine you own

const subscribe = (onStoreChange: () => void) =>
  machine.subscriptions.subscribeSelector((snapshot) => snapshot, onStoreChange);

function MachinePanel() {
  const snapshot = React.useSyncExternalStore(subscribe, machine.getSnapshot, machine.getSnapshot);

  return (
    <section>
      <p>{snapshot.currentStep?.id ?? "Not started"}</p>
      <pre>{JSON.stringify(snapshot, null, 2)}</pre>
      <button onClick={() => void machine.navigate.goToNextStep()}>Next</button>
    </section>
  );
}
```

See [Quickstart](./quickstart), [Provider and Hooks](./provider-and-hooks), [Async UI](./async-ui),
and [DevTools](./devtools) for the design rules behind these examples.
