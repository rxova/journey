---
title: "Analyzing a definition"
---

`analyzeStructure` checks a graph definition for structural problems. It is a plain function over
the definition, not a plugin over a machine:

```ts
import { analyzeStructure } from "@rxova/journey-core";

const result = analyzeStructure({
  steps: {
    login: { on: { submit: "verify" } },
    verify: { on: { ok: "done" } },
    done: {},
    orphan: {}
  },
  initial: "login"
});
```

Nothing it reports needs a runtime — it is the definition being checked, not a run — so this works
in a unit test or a build step, before any machine exists. That is also why it is a function: it
used to be a plugin, which meant creating a machine in order to ask a question about the definition
you already had.

## Checks

- **unreachable steps** — declared but not reachable from `initial`;
- **shadowed transitions** — an earlier unguarded candidate on the same `(from, event)` always
  wins, so anything after it can never be selected;
- **cycles**;
- **no terminal path** — no reachable step without outgoing transitions.

Completion is explicit in this model, so terminal steps are reported as facts in the summary rather
than as dead-end issues.

```ts
result.issues; // { code, severity, message, stepId?, from?, event?, steps? }[]
result.summary;
// {
//   stepCount, reachableStepCount, unreachableStepCount,
//   terminalStepIds, cycleCount, shadowedTransitionCount, terminalPathExists
// }
```

Linear journeys have no transition graph, so there is nothing here to analyze.

## Where to next

- [Execution paths](../plugins/execution-paths-plugin)
- [Graph](../usage/graph)
