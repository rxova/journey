# @rxova/journey-core

<p>
  <a href="https://github.com/rxova/journey/actions/workflows/ci.yml">
    <img src="https://github.com/rxova/journey/actions/workflows/ci.yml/badge.svg?branch=main" alt="CI" />
  </a>
  <img src="https://img.shields.io/badge/TypeScript-strict-blue" alt="TypeScript" />
  <img src="https://img.shields.io/badge/coverage-100%25-brightgreen" alt="Coverage" />
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

Headless Journey runtime for non-React environments.

- Docs: https://rxova.org/docs/core/getting-started
- API: https://rxova.org/docs/core/api
- History: https://rxova.org/docs/core/history
- Persistence: https://rxova.org/docs/core/persistence
- Examples: https://rxova.org/docs/core/examples

## Install

```bash
npm i @rxova/journey-core
```

## Quickstart

```ts
import { createJourneyMachine, JOURNEY_TERMINAL } from "@rxova/journey-core";

type StepId = "start" | "review";
type Event = "next" | "submit";

type Ctx = { name: string };

const journey = {
  initial: "start",
  context: { name: "" },
  steps: { start: {}, review: {} },
  transitions: [
    { from: "start", event: "next", to: "review" },
    { from: "review", event: "submit", to: JOURNEY_TERMINAL.COMPLETE }
  ]
};

const machine = createJourneyMachine<Ctx, StepId, Event>(journey);
await machine.send({ type: "next" });
```
