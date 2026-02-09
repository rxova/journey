# Getting Started

This guide is written for junior developers. You can copy-paste every step.

If you want the smallest possible example first, open:

- `examples/simple-flow.tsx`
- `examples/simple-sequence.flow.tsx`

## Quickstarts

### A) Fastest UI Quickstart (React)

Use this when you want a visible flow in under 5 minutes.

```tsx
import React from "react";
import {
  FlowProvider,
  FlowStepRenderer,
  useFlow,
  FLOW_TERMINAL,
  type FlowReactFlow
} from "react-toolkit-flow";

type StepId = "start" | "review";
type Ctx = { name: string };

const Start = () => {
  const { api } = useFlow<Ctx, StepId>();
  return (
    <button
      onClick={() => {
        api.updateContext((ctx) => ({ ...ctx, name: "Ada" }));
        api.next();
      }}
    >
      Continue
    </button>
  );
};

const Review = () => {
  const { snapshot, api } = useFlow<Ctx, StepId>();
  return (
    <div>
      <p>Hello {snapshot.context.name}</p>
      <button onClick={() => api.submit()}>Finish</button>
    </div>
  );
};

const flow: FlowReactFlow<Ctx, StepId> = {
  initial: "start",
  context: { name: "" },
  steps: {
    start: { component: Start },
    review: { component: Review }
  },
  transitions: [
    { from: "start", event: "next", to: "review" },
    { from: "review", event: "submit", to: FLOW_TERMINAL.COMPLETE }
  ]
};

export const App = () => (
  <FlowProvider flow={flow}>
    <FlowStepRenderer<Ctx, StepId> />
  </FlowProvider>
);
```

### B) Headless Quickstart (Core Only, No React)

Use this in tests, services, or custom renderers.

```ts
import { createFlowMachine, FLOW_TERMINAL, type FlowFlow } from "react-toolkit-flow/core";

type StepId = "a" | "b";
type Event = "next" | "submit";
type Ctx = { count: number };

const flow: FlowFlow<Ctx, StepId, Event> = {
  initial: "a",
  context: { count: 0 },
  steps: { a: {}, b: {} },
  transitions: [
    {
      from: "a",
      event: "next",
      to: "b",
      effect: ({ context }) => ({ ...context, count: context.count + 1 })
    },
    { from: "b", event: "submit", to: FLOW_TERMINAL.COMPLETE }
  ]
};

const machine = createFlowMachine(flow);
await machine.send({ type: "next" });
console.log(machine.getSnapshot()); // current: "b", context.count: 1
```

### C) Persistence Quickstart

Use this to restore step + context after refresh.

```tsx
<FlowProvider
  flow={flow}
  persistence={{
    key: "my-flow",
    version: 1
  }}
>
  <FlowStepRenderer />
</FlowProvider>
```

## 1. Install

```bash
npm i react-toolkit-flow
```

## 2. Define Your Step IDs and Context

```ts
type StepId = "start" | "details" | "review";
type Ctx = {
  includeDetails: boolean;
  dirty: boolean;
};
```

## 3. Create Step Components

Each component should focus on UI.

```tsx
const Start = () => {
  const { api } = useFlow<Ctx, StepId>();
  return <button onClick={() => api.next()}>Continue</button>;
};
```

## 4. Create the Flow

```ts
const flow: FlowReactFlow<Ctx, StepId> = {
  initial: "start",
  context: { includeDetails: true, dirty: false },
  steps: {
    start: { component: Start },
    details: { component: Details },
    review: { component: Review }
  },
  transitions: [
    {
      from: "start",
      event: "next",
      to: "details",
      when: ({ context }) => context.includeDetails
    },
    {
      from: "start",
      event: "next",
      to: "review",
      when: ({ context }) => !context.includeDetails
    },
    { from: "details", event: "next", to: "review" },
    { from: "*", event: "back", to: HISTORY_TARGET },
    { from: "review", event: "submit", to: FLOW_TERMINAL.COMPLETE }
  ]
};
```

## 5. Render the Flow

```tsx
<FlowProvider flow={flow}>
  <FlowStepRenderer<Ctx, StepId> />
</FlowProvider>
```

## 6. Update Context

```tsx
api.updateContext((ctx) => ({ ...ctx, dirty: true }));
```

## 7. Debug Quickly

```tsx
const { snapshot } = useFlow<Ctx, StepId>();
console.log(snapshot.current, snapshot.context, snapshot.history);
```

## 8. Understand Async (`when`, `effect`, and errors)

This is the part that usually confuses people first.

- `when`: gatekeeper for transitions.
  - "Should we move?"
  - Returns `boolean` or `Promise<boolean>`.
- `effect`: side-effects + context update.
  - "Do work while moving."
  - Returns new context or `void`.

```ts
{
  from: "details",
  event: "next",
  to: "review",
  when: async ({ context }) => {
    // block transition if invalid
    return await isFormValid(context);
  },
  effect: async ({ context }) => {
    // save before moving
    const draft = await saveDraft(context);
    return { ...context, draftId: draft.id };
  }
}
```

### What happens on errors?

If `when` or `effect` throws:

- `api.next()` / `machine.send(...)` rejects
- current step async phase becomes `error`
- error is available at `snapshot.async.byStep[snapshot.current].error`

```tsx
const { snapshot, api } = useFlow<Ctx, StepId>();
const asyncState = snapshot.async.byStep[snapshot.current];

if (asyncState.phase === "error") {
  return (
    <div>
      <p>Request failed. Try again.</p>
      <button onClick={() => api.clearStepError()}>Dismiss Error</button>
    </div>
  );
}
```

### Persistence compatibility

- persisted: `current`, `context`, `history`, `terminal`
- not persisted: `snapshot.async` (loading/error runtime state)

So after refresh/hydrate/reset, async state starts clean (`idle`).

## Common Beginner Mistakes

- Missing step IDs in `steps`.
  - Fix: every transition target must exist in `steps`.
- Putting navigation logic in components.
  - Fix: keep navigation in `transitions`.
- Forgetting `HISTORY_TARGET`.
  - Fix: add `{ from: "*", event: "back", to: HISTORY_TARGET }`.
