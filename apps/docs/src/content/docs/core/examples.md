---
id: examples
title: Examples
sidebar_label: Examples
---

# Examples

Sometimes the fastest way to understand a flow is to run one. Each example below is a standalone Vite
app in the repo under `examples/`, built around a single mode so you can see it end to end.

## Core examples (framework-free)

These use `@rxova/journey-core` on its own — no UI framework.

| Example                  | What it shows                                                         | Open                                                                                 |
| ------------------------ | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `core-showcase-linear`   | A linear flow with sequential steps, step metadata, and progress      | [View →](https://github.com/rxova/journey/tree/main/examples/core-showcase-linear)   |
| `core-showcase-graph`    | A graph flow with the builder, branching, guards, and execution paths | [View →](https://github.com/rxova/journey/tree/main/examples/core-showcase-graph)    |
| `core-showcase-headless` | A headless flow with caller-driven navigation and observable state    | [View →](https://github.com/rxova/journey/tree/main/examples/core-showcase-headless) |

## React examples

These use `@rxova/journey-react` — provider, hooks, and DevTools integration.

| Example                   | What it shows                                                 | Open                                                                                  |
| ------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `react-showcase-linear`   | A linear flow with step components and `LinearJourneyRuntime` | [View →](https://github.com/rxova/journey/tree/main/examples/react-showcase-linear)   |
| `react-showcase-graph`    | A graph flow with the builder and event-driven navigation     | [View →](https://github.com/rxova/journey/tree/main/examples/react-showcase-graph)    |
| `react-showcase-headless` | A headless flow with custom rendering logic                   | [View →](https://github.com/rxova/journey/tree/main/examples/react-showcase-headless) |

## Run one locally

```bash
pnpm install
pnpm -C examples/core-showcase-linear dev
# or
pnpm -C examples/react-showcase-graph dev
```

Want focused snippets instead of whole apps? [Recipes](/docs/core/recipes) has the common patterns.
