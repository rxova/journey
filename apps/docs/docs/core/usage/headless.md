---
id: headless
title: Headless
---

# Headless

Headless is a usage pattern, not a third machine kind: a core machine consumed without any
rendering tier. There are exactly two factories — `createLinearJourney` and `createGraphJourney` —
and both produce machines that work anywhere JavaScript runs: Node scripts, tests, workers, CLI
tools, or a UI framework you wire yourself.

## Plain-core usage

Create a machine, subscribe, start, and navigate — no framework involved:

```ts
import { createLinearJourney } from "@rxova/journey-core";

const machine = createLinearJourney({
  steps: ["start", "configure", "confirm"] as const,
  context: { plan: "free" }
});

const stop = machine.subscriptions.subscribeEvent("stepEnter", ({ to, direction }) => {
  console.log(`entered ${to} (${direction})`);
});

machine.controls.start();
await machine.navigate.goToNextStep();
await machine.navigate.goToStepById("confirm");

machine.controls.complete({ plan: machine.getSnapshot().context.plan });
stop();
machine.dispose();
```

Graph machines are just as headless — `send` events, read `availableEvents`, and observe named
subscription events:

```ts
import { createGraphJourney } from "@rxova/journey-core";

const machine = createGraphJourney(definition);

machine.controls.start();
await machine.send("SUBMIT", { email: "ada@example.com" });
machine.getSnapshot().availableEvents;
```

Drive rendering (or logging, or nothing at all) from `subscribeSelector`, `subscribeEvent`, and
`getSnapshot()`. The machine object is stable; all changing state lives in the snapshot.

## Headless in React

When a React app owns the machine outside the rendering tiers, `@rxova/journey-react/headless`
provides machine-argument hooks over any core machine: `useJourneySnapshot(machine)`,
`useJourneySelector(machine, selector)`, `useJourneyEvent(machine, event, listener)`, and
`useOwnedJourney(factory)` for a component-owned machine with StrictMode-safe disposal. See the
React package documentation for the full tier.

## Where to next

- [Choosing a mode](./)
- [Linear](./linear)
- [Graph](./graph)
