---
title: Execution paths
sidebar_label: Execution paths
---

# Execution paths

The execution-paths plugin enumerates the routes through your flow — every declared path from the
initial step — without running anything. It's built for understanding shape: reviewing complexity
before you ship, asserting on a flow's structure in tests, or generating diagrams from a definition.

## Install and use

```ts
import { createGraphJourney } from "@rxova/journey-core";
import { createExecutionPathsPlugin } from "@rxova/journey-core/execution-paths";

const machine = createGraphJourney(journey, {
  plugins: [createExecutionPathsPlugin()]
});

const result = machine.getExecutionPaths({ maxDepth: 6, maxPaths: 20 });
```

## What you get

```ts
machine.getExecutionPaths(options);
```

The result reports the discovered paths plus whether traversal hit its limits:

- `paths` — the structural paths from the initial step;
- `truncated` — whether limits cut traversal short;
- `cyclesDetected` — whether cycles were encountered.

Each path carries ordered `steps`, ordered `events`, and a termination reason — `final`, `depth`,
`cycle`, or `limit` — so you can tell a completed route from one the limits stopped.

## What it's good for

- Reviewing graph complexity before shipping.
- Writing tests that assert the declared shape of a flow.
- Generating tooling or diagrams from a definition.
- Spotting unexpected cycles or dead ends in authored transitions.

## What it doesn't do

:::warning
This is **structural** analysis, not behavioral. It doesn't run guards, commit context, or read live
context values, so it can't prove a path is reachable for a specific user at runtime. Read it as
"what the declared graph allows," not "what someone will actually do."
:::

## Traversal limits

Cap traversal when the graph has cycles or you only need a bounded look:

```ts
const result = machine.getExecutionPaths({ maxDepth: 8, maxPaths: 50 });
```

This keeps inspection practical even on large flows — the result's `truncated` and `cyclesDetected`
flags tell you when a limit kicked in.

## Where to next

- [Diagnostics](/docs/core/plugins/diagnostics-plugin) — structural validation with severity levels.
- [Graph mode](/docs/core/usage/graph) — the transitions being traversed.
