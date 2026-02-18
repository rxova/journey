# @rxova/journey-core

<p>
  <a href="https://www.npmjs.com/package/@rxova/journey-core">
    <img src="https://img.shields.io/badge/npm-%40rxova%2Fjourney--core-CB3837?logo=npm&logoColor=white" alt="npm package @rxova/journey-core" />
  </a>
  <a href="https://rxova.org/docs/core/getting-started">
    <img src="https://img.shields.io/badge/docs-core-0f8f6a" alt="Core docs" />
  </a>
  <a href="https://github.com/rxova/journey/actions/workflows/ci.yml">
    <img src="https://github.com/rxova/journey/actions/workflows/ci.yml/badge.svg?branch=main" alt="CI" />
  </a>
  <img src="https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/coverage%20(core)-100%25-brightgreen" alt="Core coverage" />
  <a href="https://www.npmjs.com/package/@rxova/journey-core">
    <img src="https://img.shields.io/npm/v/@rxova/journey-core" alt="npm version" />
  </a>
  <a href="https://www.npmjs.com/package/@rxova/journey-core">
    <img src="https://img.shields.io/npm/dm/@rxova/journey-core" alt="npm downloads" />
  </a>
  <a href="https://bundlephobia.com/package/@rxova/journey-core">
    <img src="https://img.shields.io/bundlephobia/minzip/%40rxova%2Fjourney-core" alt="Bundlephobia" />
  </a>
</p>

Headless runtime for step journeys and non-linear flows.

Use `@rxova/journey-core` when you want flow logic that is independent from UI frameworks.

`[GETTING STARTED](https://rxova.org/docs/core/getting-started) | [ARCHITECTURE](https://rxova.org/docs/core/architecture) | [API](https://rxova.org/docs/core/api) | [HISTORY](https://rxova.org/docs/core/history) | [PERSISTENCE](https://rxova.org/docs/core/persistence) | [ASYNC](https://rxova.org/docs/core/async) | [EXAMPLES](https://rxova.org/docs/core/examples)`

## Install

```bash
npm i @rxova/journey-core
```

## What You Get

- Strongly typed journey definition and events.
- Deterministic transition matching.
- Built-in history, persistence helpers, and async lifecycle hooks.
- A reusable machine API you can run in frontend or backend code.

## Quickstart

```ts
import { createJourneyMachine, JOURNEY_TERMINAL } from "@rxova/journey-core";

type StepId = "start" | "review";
type Event = "next" | "submit";

type Ctx = { name: string };

// 1) Describe the flow as data.
const journey = {
  initial: "start",
  context: { name: "" },
  steps: { start: {}, review: {} },
  transitions: [
    { from: "start", event: "next", to: "review" },
    { from: "review", event: "submit", to: JOURNEY_TERMINAL.COMPLETE }
  ]
};

// 2) Create a machine instance.
const machine = createJourneyMachine<Ctx, StepId, Event>(journey);

// 3) Drive the flow with typed events.
await machine.send({ type: "next" });

// 4) Read immutable runtime state at any time.
const snapshot = machine.getSnapshot();
console.log(snapshot.current);
```

## Coverage Notes

Coverage badge is package-specific (`packages/core/test` against `packages/core/src`), not monorepo-wide.
