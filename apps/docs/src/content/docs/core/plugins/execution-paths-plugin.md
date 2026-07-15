---
id: execution-paths-plugin
title: Execution paths
---

# Execution paths

The execution-paths plugin records paths that actually run. It does not enumerate possible graph
paths.

```ts
import { createExecutionPathsPlugin } from "@rxova/journey-core/execution-paths";

const machine = createLinearJourney(definition, {
  plugins: [createExecutionPathsPlugin()]
});

machine.controls.start();
await waitUntilSettled(machine);
await machine.navigate.goToNextStep();

machine.plugins["execution-paths"].getCurrentPath();
```

## API

```ts
const api = machine.plugins["execution-paths"];

api.getCurrentPath();
api.getCompletedPaths();
```

The current path receives each settled destination, including initial entry. Completing or
terminating moves that path into completed paths and starts an empty current path. Restart then
begins a new path when its initial entry settles.

## Snapshot

```ts
machine.getSnapshot().plugins["execution-paths"];
// { currentPath: readonly string[], completedPaths: readonly string[][] }
```

Returned collections are readonly copies.

## Where to next

- [Diagnostics](./diagnostics-plugin)
- [Plugins](./overview)
