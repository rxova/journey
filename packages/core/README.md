# @rxova/journey-core

The core Journey state machine for non-React environments. Use this package if you want the smallest, framework-agnostic runtime.

## Install

```bash
pnpm add @rxova/journey-core
npm install @rxova/journey-core
yarn add @rxova/journey-core
```

## Basic usage

```ts
import {
  createJourneyMachine,
  JOURNEY_TERMINAL,
  type JourneyDefinition
} from "@rxova/journey-core";

type StepId = "one" | "two" | "three";
type Event = "next" | "submit";
type Ctx = { name: string };

const journey: JourneyDefinition<Ctx, StepId, Event> = {
  initial: "one",
  context: { name: "" },
  steps: {
    one: {},
    two: {},
    three: {}
  },
  transitions: [
    { from: "one", event: "next", to: "two" },
    { from: "two", event: "next", to: "three" },
    { from: "three", event: "submit", to: JOURNEY_TERMINAL.COMPLETE }
  ]
};

const machine = createJourneyMachine<Ctx, StepId, Event>(journey);
```

## History behavior

The machine tracks two related collections:

- `history`: ordered list of prior steps. It grows when you move to a different step.
- `visited`: list of steps you have reached (including current), with duplicates removed. It is not affected by history trimming.

Why `visited` is a list (not a `Set`) for the following reasons:

- JSON-friendly for snapshots, logs, and persistence.
- Deterministic order for tests and UI rendering.
- Easier to consume in TypeScript (`readonly TStepId[]`).
- It is derived from `history + current` initially, then maintained independently so trimming history does not remove earlier entries.

History is used when you target `HISTORY_TARGET` in a transition. It resolves to the most recent valid step in `history`. If history is empty (or contains invalid steps), the machine stays on the current step.

### History retention

You can cap history growth with `maxHistory`. When the history exceeds that limit, the oldest entries are trimmed.

Defaults:

- `maxHistory`: `50`
- `maxHistory: null` disables trimming entirely.

Automatic trimming happens:

- After transitions (including `goTo`)
- After persistence hydrate

### Overflow callback

`onOverflow` fires only when trimming actually happens. It receives:

- `previous`: history before trimming
- `next`: history after trimming
- `trimmed`: entries removed
- `maxHistory`: resolved limit (number or `null`)
- `reason`: `"auto" | "hydrate" | "manual"`
  - `auto`: trimming happened automatically during a transition (including `goTo`)
  - `hydrate`: trimming happened right after loading persisted state
  - `manual`: trimming happened because you called `trimHistory()`

### Config example

```ts
const machine = createJourneyMachine(journey, {
  history: {
    maxHistory: 20,
    onOverflow: ({ trimmed, reason }) => {
      console.warn("trimmed history", trimmed, "reason:", reason);
    }
  }
});
```

### History target example

```ts
import { HISTORY_TARGET } from "@rxova/journey-core";

const journey: JourneyDefinition<Ctx, StepId, Event> = {
  initial: "one",
  context: { name: "" },
  steps: {
    one: {},
    two: {},
    three: {}
  },
  transitions: [
    { from: "one", event: "next", to: "two" },
    { from: "two", event: "next", to: "three" },
    { from: "*", event: "back", to: HISTORY_TARGET }
  ]
};
```

### Manual history management

```ts
const machine = createJourneyMachine(journey, { history: { maxHistory: 5 } });

await machine.send({ type: "goTo", to: "two" });
await machine.send({ type: "goTo", to: "three" });

machine.trimHistory(1); // keep most recent entry only
machine.clearHistory(); // reset history to []
```

## Links

- Docs: https://rxova.org/journey/docs/core/getting-started
- API: https://rxova.org/journey/docs/core/api
- React bindings: ../react
