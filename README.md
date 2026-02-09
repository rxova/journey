# react-toolkit-flow

Tiny, zero-runtime-dependency React flow/stepper built around one declarative flow model.

## Why

This library is designed for modal multi-step forms where path length changes dynamically (for example: 4-6 steps depending on user choices), without scattering branch logic across components.

## Install

```bash
npm i react-toolkit-flow
```

`react` is a peer dependency.

## Core Model

One model for all flows:

- `steps`: step registry (what can render)
- `transitions`: ordered graph edges (what can happen)
- `context`: form/business state
- `history`: runtime visited stack (for deterministic back behavior)

## Quick Start

```tsx
import React from "react";
import {
  FlowProvider,
  FlowStepRenderer,
  useFlow,
  HISTORY_TARGET,
  FLOW_TERMINAL,
  type FlowReactFlow
} from "react-toolkit-flow";

type StepId = "start" | "details" | "review" | "confirmExit";
type Event = "next" | "back" | "close" | "submit";
type Ctx = { dirty: boolean; includeDetails: boolean };

const Start = () => {
  const { api } = useFlow<Ctx, StepId, Event>();
  return <button onClick={() => api.next()}>Next</button>;
};

const Details = () => {
  const { api } = useFlow<Ctx, StepId, Event>();
  return <button onClick={() => api.next()}>Next</button>;
};

const Review = () => {
  const { api } = useFlow<Ctx, StepId, Event>();
  return <button onClick={() => api.submit()}>Submit</button>;
};

const ConfirmClose = () => <div>Are you sure you want to close?</div>;

const flow: FlowReactFlow<Ctx, StepId, Event> = {
  initial: "start",
  context: { dirty: false, includeDetails: true },
  steps: {
    start: { component: Start },
    details: { component: Details },
    review: { component: Review },
    confirmExit: { component: ConfirmClose }
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
    {
      from: "*",
      event: "close",
      to: "confirmExit",
      when: ({ context }) => context.dirty
    },
    {
      from: "*",
      event: "close",
      to: FLOW_TERMINAL.CLOSE,
      when: ({ context }) => !context.dirty
    },
    { from: "review", event: "submit", to: FLOW_TERMINAL.COMPLETE }
  ]
};

export const App = () => (
  <FlowProvider flow={flow}>
    <FlowStepRenderer<Ctx, StepId, Event> />
  </FlowProvider>
);
```

## API

See [docs/API.md](./docs/API.md).

## Examples

See [examples/group-trip.flow.tsx](./examples/group-trip.flow.tsx) and [examples/itinerary-builder.flow.tsx](./examples/itinerary-builder.flow.tsx).

## Migration

See [docs/MIGRATION.md](./docs/MIGRATION.md).

## Scripts

```bash
npm run lint
npm run format:check
npm run typecheck
npm run build
npm run test
npm run size
```

## License

MIT.
