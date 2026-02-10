# react-toolkit-flow

[![npm version](https://img.shields.io/npm/v/react-toolkit-flow)](https://www.npmjs.com/package/react-toolkit-flow)
[![npm downloads](https://img.shields.io/npm/dm/react-toolkit-flow)](https://www.npmjs.com/package/react-toolkit-flow)
[![Bundlephobia](https://img.shields.io/bundlephobia/minzip/react-toolkit-flow)](https://bundlephobia.com/package/react-toolkit-flow)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)
![Coverage](https://img.shields.io/badge/coverage-100%25-brightgreen)
![Build checks](https://img.shields.io/badge/build-lint%20%7C%20typecheck%20%7C%20tests-brightgreen)

Tiny, zero-runtime-dependency React flow/stepper built around one declarative flow model.

## Why

This library is designed for modal multi-step forms where path length changes dynamically (for example: 4-6 steps depending on user choices), without scattering branch logic across components.

## Why This Over Other Wizard Libraries

| Area                               | Ours                                                                                                                            | Typical index-based wizard libs                                                     |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Flow modeling                      | ✅ Declarative graph (`steps` + ordered `transitions`) as the single source of truth.                                           | ⚠️ Usually step index + imperative branching spread across components.              |
| Conditional branching / skip       | ✅ First-class via `when` guards in transitions.                                                                                | ⚠️ Commonly manual `if` branching in UI handlers.                                   |
| Runtime dynamic steps              | ✅ Supported by rebuilding `steps` + `transitions` graph at runtime (see `examples/dynamic-steps.flow.tsx`).                    | ⚠️ Often limited to hide/show step UI while navigation logic remains index-coupled. |
| Deterministic back behavior        | ✅ Built-in with history semantics (`HISTORY_TARGET`).                                                                          | ⚠️ Frequently manual index/history bookkeeping.                                     |
| Async validation/effects lifecycle | ✅ Built-in async `when`/`effect` with per-step phase/error capture in `snapshot.async`.                                        | ⚠️ Usually hand-rolled loading/error state + race handling.                         |
| Lifecycle visibility               | ✅ Explicit runtime phases (`idle`, `evaluating-when`, `running-effect`, `error`) for each step.                                | ⚠️ Lifecycle is often implicit and dispersed across local state/effects.            |
| Persistence                        | ✅ Optional persistence adapter with versioning, migration, and reset behavior controls.                                        | ⚠️ Commonly custom localStorage/session code with no standard migration path.       |
| SSR / RSC safety                   | ✅ `core` is server-safe, `react` entry is client-bound (`"use client"`), root supports `react-server` condition.               | ⚠️ Frequently undocumented or prone to context/hook usage in server paths.          |
| Framework compatibility            | ✅ Documented patterns for Next.js App Router, Pages Router, Remix/React Router SSR, and custom SSR.                            | ⚠️ Often focused on CSR-first usage with partial SSR guidance.                      |
| Type safety                        | ✅ Strong generic typing for steps, events, payloads, context, and API methods.                                                 | ⚠️ Often looser event/payload typing or any-like extension points.                  |
| Bundle-size discipline             | ✅ Size-limit budgets enforced: core import target `2.2 kB`, react hook target `3.6 kB`, root core tree-shaken target `2.3 kB`. | ⚠️ Often no explicit size budgets or CI guardrails.                                 |
| Coverage                           | ✅ Test suite runs at 100% (statements, branches, functions, lines).                                                            | ⚠️ Coverage targets are often lower or not enforced.                                |
| API ergonomics / dev warnings      | ✅ Clear provider-boundary errors (e.g. `useFlow must be used within <FlowProvider>.`).                                         | ⚠️ Commonly generic runtime null/undefined errors.                                  |

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

## Framework Compatibility

- Next.js App Router: supported. Keep flow engine logic in server-safe imports (`react-toolkit-flow/core`) and UI hooks/provider in client components (`react-toolkit-flow/react`).
- Next.js Pages Router: supported. Use React APIs normally in pages/components.
- Remix / React Router SSR: supported. Keep provider/hooks inside client-rendered React trees; use core machine in shared/server code paths.
- Vite SSR / custom React SSR: supported. `core` has no React dependency; `react` entry is client-bound.

Import rule of thumb:

- If code can execute on the server, import from `react-toolkit-flow/core`.
- If code uses hooks/context/components, import from `react-toolkit-flow/react` in a client component/module.

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

## Coverage Reports

- Local: `npm run test` writes an HTML report to `coverage/index.html`.
- CI (GitHub Actions): each `CI` run publishes a `coverage-report` artifact and a coverage summary in the run summary.

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
