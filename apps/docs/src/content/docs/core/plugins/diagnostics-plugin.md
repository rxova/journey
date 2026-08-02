---
title: "Diagnostics"
---

The diagnostics plugin analyzes the normalized structural definition once and caches the result.

```ts
import { createDiagnosticsPlugin } from "@rxova/journey-core/diagnostics";

const machine = createGraphJourney(definition, {
  plugins: [createDiagnosticsPlugin()]
});

const result = machine.plugins.diagnostics.getDiagnostics();
```

## Checks

Graph diagnostics report:

- unreachable steps;
- transitions shadowed by earlier unguarded candidates;
- cycles;
- absence of a path to a terminal step.

The result also includes step counts, reachable and terminal ids, cycle and shadow counts, and
`terminalPathExists`.

For linear journeys, graph checks are skipped and `summary.graphChecksSkipped` is `true`.

`analyzeStructure` and `getGraphDiagnostics` are exported from the same entry point for build-time
or custom tooling.

## Where to next

- [Execution paths](./execution-paths-plugin)
- [Plugins](./overview)
