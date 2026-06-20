---
title: Diagnostics
sidebar_label: Diagnostics
---

# Diagnostics

The diagnostics plugin checks the _structure_ of your flow — before anyone runs it. It reads the
journey definition and reports issues like unreachable steps, dead ends, and cycles, which makes it
a natural fit for authoring, tests, and CI gates.

It doesn't inspect live runtime state; it analyzes the declared graph.

## Install and use

```ts
import { createGraphJourney } from "@rxova/journey-core";
import { createDiagnosticsPlugin } from "@rxova/journey-core/diagnostics";

const machine = createGraphJourney(journey, {
  plugins: [createDiagnosticsPlugin()]
});

const diagnostics = machine.getDiagnostics({ requireExplicitCompletion: true });
```

## What you get

```ts
machine.getDiagnostics(options);
```

The result has two parts — the findings and an aggregate summary:

- `issues` — ordered structural findings, each with a `code`, a severity (`warning` or `error`), and
  context-dependent fields like `stepId`, `from`, `eventType`, `transitionId`, `label`, or `steps`.
- `summary` — counts and metadata: `mode`, `stepCount`, `reachableStepCount`,
  `unreachableStepCount`, `deadEndCount`, `cycleCount`, `shadowedTransitionCount`,
  `graphChecksSkipped`, and `terminalPathExists`.

## What it checks

| Code                      | Meaning                                                                       |
| ------------------------- | ----------------------------------------------------------------------------- |
| `unreachable-step`        | A declared step nothing can reach from the initial step                       |
| `dead-end-step`           | A reachable step with no outgoing transition and no terminal exit             |
| `shadowed-transition`     | An unconditional transition that hides later ones for the same `from + event` |
| `cycle-detected`          | A cycle in the declared graph                                                 |
| `no-terminal-path`        | No terminal path is reachable from the initial step                           |
| `duplicate-transition-id` | Two transitions share an id                                                   |

## Options

`requireExplicitCompletion` — when `true`, the last step of a linear journey isn't treated as an
implicit terminal path. Turn it on for teams that require explicit terminal transitions instead of
relying on linear auto-completion.

## Gotchas

:::note
For headless journeys there's no declared graph to analyze, so graph-only checks are skipped and
`summary.graphChecksSkipped` is `true`. That's expected, not a failure.
:::

A good pattern is to assert on diagnostics in a test so a structural regression — an orphaned step, a
missing terminal path — fails CI instead of shipping.

## Where to next

- [Execution paths](/docs/core/plugins/execution-paths-plugin) — enumerate the paths through the graph.
- [Graph mode](/docs/core/usage/graph) — the transitions these checks analyze.
