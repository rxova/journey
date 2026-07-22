---
id: examples
title: React Examples
sidebar_label: Examples
---

The repository's `examples/` workspace contains runnable Vite applications for every supported
React surface.

## Showcase applications

- `react-showcase-linear` demonstrates declarative JSX steps, context edits, transactional work,
  lifecycle callbacks, persistence, and typed bundle hooks.
- `react-showcase-graph` demonstrates a standalone graph bundle machine, typed domain events,
  synchronous route guards, graph snapshot introspection, and DevTools attached straight to
  `journey.machine`.
- `react-showcase-headless` demonstrates machine-argument hooks over an existing Core machine.

Run an example from the repository root:

```bash
pnpm --filter examples-react-showcase-graph dev
```

## Plugin applications

The six `react-plugin-*` examples create fully typed Core machines and consume them through
`@rxova/journey-react/headless`. They demonstrate exact event-hook signatures and namespaced
`machine.plugins` APIs for analytics, autosave, diagnostics, execution paths, persistence, and
replay.

For example:

```tsx
const snapshot = useJourneySnapshot(machine);

useJourneyEvent(machine, "stepEnter", ({ from, to }) => {
  console.log(from, to);
});

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

## Minimal headless panel

```tsx
function MachinePanel({ machine }) {
  const snapshot = useJourneySnapshot(machine);

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
