---
title: Getting Started
sidebar_position: 1
---

This guide is for `@rxova/journey-core` only (headless, framework-agnostic).

Use it when you want to run journey logic in Node services, tests, CLIs, or your own UI layer.

## 1. Install

```bash
npm i @rxova/journey-core
```

## 2. Define Your Journey Types

```ts
type StepId = "start" | "details" | "review" | "confirmExit";
type Event = "next" | "back" | "close" | "submit";
type Context = {
  name: string;
  dirty: boolean;
  includeDetails: boolean;
};
```

## 3. Create a Journey Definition

```ts
import { HISTORY_TARGET, JOURNEY_TERMINAL, type JourneyDefinition } from "@rxova/journey-core";

const journey: JourneyDefinition<Context, StepId, Event> = {
  initial: "start",
  context: {
    name: "",
    dirty: false,
    includeDetails: true
  },
  steps: {
    start: {},
    details: {},
    review: {},
    confirmExit: {}
  },
  transitions: [
    { from: "start", event: "next", to: "details" },
    {
      from: "details",
      event: "next",
      to: "review",
      when: ({ context }) => context.includeDetails
    },
    { from: "*", event: "back", to: HISTORY_TARGET },
    {
      from: "*",
      event: "close",
      to: "confirmExit",
      when: ({ context }) => context.dirty
    },
    {
      from: "*",
      event: "close",
      to: JOURNEY_TERMINAL.CLOSE,
      when: ({ context }) => !context.dirty
    },
    { from: "review", event: "submit", to: JOURNEY_TERMINAL.COMPLETE }
  ]
};
```

## 4. Create the Machine

```ts
import { createJourneyMachine } from "@rxova/journey-core";

const machine = createJourneyMachine(journey);
```

## 5. Send Events and Read Snapshot

```ts
await machine.send({ type: "next" });
await machine.send({ type: "next" });

const snapshot = machine.getSnapshot();

console.log(snapshot.current); // "review"
console.log(snapshot.history); // ["start", "details"]
console.log(snapshot.visited); // ["start", "details", "review"]
console.log(snapshot.status); // "running"
```

## 6. Update Context

```ts
machine.updateContext((ctx) => ({ ...ctx, name: "Ada", dirty: true }));
```

## 7. Use Built-in `goTo`

```ts
await machine.send({ type: "goTo", to: "review" });
```

- `goTo` is built in.
- It validates the target step exists.
- It appends the previous step to `history` (unless target equals current).

## 8. Async Guards and Effects

```ts
const asyncJourney: JourneyDefinition<Context, StepId, Event> = {
  ...journey,
  transitions: [
    {
      id: "save-and-continue",
      from: "details",
      event: "next",
      to: "review",
      when: async ({ context }) => context.name.trim().length > 0,
      effect: async ({ context }) => {
        const savedName = await Promise.resolve(context.name.trim());
        return { ...context, name: savedName };
      }
    }
  ]
};
```

If `when` or `effect` throws:

- `send(...)` rejects.
- Current step async state goes to `error`.
- You can inspect and clear it:

```ts
const step = machine.getSnapshot().current;
const stepAsync = machine.getSnapshot().async.byStep[step];

if (stepAsync.phase === "error") {
  console.error(stepAsync.error);
  machine.clearStepError(step);
}
```

## 9. Persistence and History Limits

```ts
const machineWithOptions = createJourneyMachine(journey, {
  persistence: {
    key: "checkout-journey",
    version: 2,
    clearOnReset: false
  },
  history: {
    maxHistory: 20,
    onOverflow: ({ trimmed, reason }) => {
      console.warn("history trimmed", trimmed, reason);
    }
  }
});
```

Notes:

- Default `maxHistory` is `50`.
- Set `maxHistory: null` to disable trimming.
- Persistence stores `current`, `context`, `history`, `visited`, and `status`.
- Runtime async state (`snapshot.async`) is not persisted.

## 10. Reset and Terminal States

```ts
machine.reset();
```

- `reset()` returns to `initial`, initial `context`, empty `history`, `status: "running"`.
- After terminal (`COMPLETE` or `CLOSE`), further `send(...)` calls do not transition.

## Next

- Architecture and model rationale: `/docs/core/architecture`
- API details: `/docs/core/api`
- Snapshot model: `/docs/core/snapshot`
- Lifecycle semantics: `/docs/core/lifecycle`
- Async transitions: `/docs/core/async`
- History behavior: `/docs/core/history`
- Persistence and migrations: `/docs/core/persistence`
- Common issues and decisions: `/docs/core/faq`
- Copyable patterns: `/docs/core/recipes`
- Full example catalog: `/docs/core/examples`
