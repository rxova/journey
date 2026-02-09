# react-toolkit-flow

[![Bundlephobia](https://img.shields.io/bundlephobia/minzip/react-toolkit-flow)](https://bundlephobia.com/package/react-toolkit-flow)

Tiny, zero-runtime-dependency React flow/stepper built around one declarative flow model.

## Why

This library is designed for modal multi-step forms where path length changes dynamically (for example: 4-6 steps depending on user choices), without scattering branch logic across components.

## Install

```bash
npm i react-toolkit-flow
```

`react` is a peer dependency.

## Next.js App Router (SSR / RSC)

Use subpath imports to keep server and client code separated:

- Server code (RSC, route handlers, server actions): `react-toolkit-flow/core`
- Client components (hooks/provider/renderer): `react-toolkit-flow/react`

`react-toolkit-flow/react` is a client entrypoint and is marked with `"use client"`.
The root package also exposes a `react-server` condition that resolves to core-only exports in RSC.

```tsx
// app/page.tsx (Server Component)
import { type FlowFlow } from "react-toolkit-flow/core";
import { WizardClient } from "./WizardClient";

type StepId = "start" | "done";
type Event = "next";
type Ctx = { ok: boolean };

const flow: FlowFlow<Ctx, StepId, Event> = {
  initial: "start",
  context: { ok: true },
  steps: { start: {}, done: {} },
  transitions: [{ from: "start", event: "next", to: "done" }]
};

export default function Page() {
  return <WizardClient flow={flow} />;
}
```

```tsx
// app/WizardClient.tsx (Client Component)
"use client";

import {
  FlowProvider,
  FlowStepRenderer,
  useFlow,
  type FlowReactFlow
} from "react-toolkit-flow/react";

type StepId = "start" | "done";
type Event = "next";
type Ctx = { ok: boolean };

const Start = () => {
  const { api } = useFlow<Ctx, StepId, Event>();
  return <button onClick={() => api.next()}>Next</button>;
};

const Done = () => <div>Done</div>;

export const WizardClient = ({
  flow
}: {
  flow: Omit<FlowReactFlow<Ctx, StepId, Event>, "steps">;
}) => {
  const clientFlow: FlowReactFlow<Ctx, StepId, Event> = {
    ...flow,
    steps: {
      start: { component: Start },
      done: { component: Done }
    }
  };

  return (
    <FlowProvider flow={clientFlow}>
      <FlowStepRenderer<Ctx, StepId, Event> />
    </FlowProvider>
  );
};
```

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

## Learn Fast

- Start here: [docs/GETTING_STARTED.md](./docs/GETTING_STARTED.md)
- API details: [docs/API.md](./docs/API.md)
- Practical patterns: [docs/RECIPES.md](./docs/RECIPES.md)
- Common questions: [docs/FAQ.md](./docs/FAQ.md)
- Migration help: [docs/MIGRATION.md](./docs/MIGRATION.md)
- Example catalog: [examples/README.md](./examples/README.md)
- Quickstarts now include: React UI, Core headless, Persistence resume.
- Recipes now include: analytics hooks, submit confirmation, API-branching, restart.

## Persistence

You can persist and resume flows via `createFlowMachine(flow, { persistence })` or
`<FlowProvider persistence={...} />`. See [docs/RECIPES.md](./docs/RECIPES.md) for a
versioned migration example.

## Async UX States

The engine exposes per-step async loading/error state at `snapshot.async.byStep[stepId]`
and a global `snapshot.async.isLoading`.

Important: async state is runtime-only and not persisted. After hydrate/reset it starts clean (`idle`).
See [docs/API.md](./docs/API.md) and [docs/RECIPES.md](./docs/RECIPES.md) for full examples.

## Examples

Minimal:

- [examples/simple-flow.tsx](./examples/simple-flow.tsx)
- [examples/simple-sequence.flow.tsx](./examples/simple-sequence.flow.tsx)
- [examples/simple-back.flow.tsx](./examples/simple-back.flow.tsx)

Specific patterns:

- [examples/conditional-skip.flow.tsx](./examples/conditional-skip.flow.tsx)
- [examples/first-match-wins.flow.tsx](./examples/first-match-wins.flow.tsx)
- [examples/custom-event.flow.tsx](./examples/custom-event.flow.tsx)
- [examples/async-guard.flow.tsx](./examples/async-guard.flow.tsx)
- [examples/async-effect.flow.tsx](./examples/async-effect.flow.tsx)
- [examples/dynamic-steps.flow.tsx](./examples/dynamic-steps.flow.tsx)
- [examples/confirm-close.flow.tsx](./examples/confirm-close.flow.tsx)
- [examples/go-to-jump.flow.tsx](./examples/go-to-jump.flow.tsx)
- [examples/history-back.flow.tsx](./examples/history-back.flow.tsx)

Real journeys:

- [examples/group-trip.flow.tsx](./examples/group-trip.flow.tsx)
- [examples/itinerary-builder.flow.tsx](./examples/itinerary-builder.flow.tsx)
- [examples/onboarding.flow.tsx](./examples/onboarding.flow.tsx)
- [examples/checkout.flow.tsx](./examples/checkout.flow.tsx)
- [examples/support-ticket.flow.tsx](./examples/support-ticket.flow.tsx)

## Scripts

```bash
npm run lint
npm run format:check
npm run typecheck
npm run build
npm run test
npm run size
```

## Bundle Size

- Package metadata includes `"sideEffects": false` to maximize dead-code elimination.
- Public entrypoints are split: root (`react-toolkit-flow`), core (`react-toolkit-flow/core`), and react (`react-toolkit-flow/react`).
- `npm run size` runs `size-limit` import budgets for release checks.
- `npm run size:check` runs `size-limit` import budgets in CI for battle-tested bundle regression checks.

Recommended import style for smallest bundles:

```ts
import { createFlowMachine } from "react-toolkit-flow/core";
import { FlowProvider, useFlow } from "react-toolkit-flow/react";
```

## License

MIT.
