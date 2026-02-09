# Getting Started

This guide is written for junior developers. You can copy-paste every step.

If you want the smallest possible example first, open:

- `examples/simple-flow.tsx`
- `examples/simple-sequence.flow.tsx`

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

## Common Beginner Mistakes

- Missing step IDs in `steps`.
  - Fix: every transition target must exist in `steps`.
- Putting navigation logic in components.
  - Fix: keep navigation in `transitions`.
- Forgetting `HISTORY_TARGET`.
  - Fix: add `{ from: "*", event: "back", to: HISTORY_TARGET }`.
