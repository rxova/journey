---
id: examples
title: Examples
sidebar_label: Examples
---

# Examples

Runnable examples live in the repository under `examples/`. Each is a standalone Vite app demonstrating a specific mode.

## Core Examples (Framework-free)

These use `@rxova/journey-core` directly without a UI framework.

| Example                  | What it shows                                                                         | Link                                                                                 |
| ------------------------ | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `core-showcase-linear`   | Linear journey with sequential steps, step metadata, and progress tracking            | [View →](https://github.com/rxova/journey/tree/main/examples/core-showcase-linear)   |
| `core-showcase-graph`    | Graph journey with the builder API, branching, guards, and the execution-paths plugin | [View →](https://github.com/rxova/journey/tree/main/examples/core-showcase-graph)    |
| `core-showcase-headless` | Headless journey with caller-driven navigation and observable state                   | [View →](https://github.com/rxova/journey/tree/main/examples/core-showcase-headless) |

## React Examples

These use `@rxova/journey-react` with provider, hooks, and DevTools integration.

| Example                   | What it shows                                                  | Link                                                                                  |
| ------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `react-showcase-linear`   | Linear journey with step components and `LinearJourneyRuntime` | [View →](https://github.com/rxova/journey/tree/main/examples/react-showcase-linear)   |
| `react-showcase-graph`    | Graph journey with the builder and event-driven navigation     | [View →](https://github.com/rxova/journey/tree/main/examples/react-showcase-graph)    |
| `react-showcase-headless` | Headless journey with custom rendering logic                   | [View →](https://github.com/rxova/journey/tree/main/examples/react-showcase-headless) |

## Running Locally

```bash
pnpm install
pnpm -C examples/core-showcase-linear dev
# or
pnpm -C examples/react-showcase-graph dev
```

For focused patterns, see [Recipes](/docs/core/recipes).
