---
title: "Execution Paths Plugin"
---

# Execution Paths Plugin

The execution-paths plugin adds structural path analysis to a machine.

It does not run the journey. It reads the resolved definition and enumerates possible declared paths from the initial step. That makes it useful for tooling, tests, flow review, and product conversations where you want to understand the shape of the graph without evaluating guards or mutating runtime state.

## Install And Use

```ts
import { createJourneyMachine } from "@rxova/journey-core";
import { createExecutionPathsPlugin } from "@rxova/journey-core/execution-paths";

const machine = createJourneyMachine(journey, {
  plugins: [createExecutionPathsPlugin()]
});

const paths = machine.getExecutionPaths({
  maxDepth: 6,
  maxPaths: 20
});
```

## What You Get

The plugin augments the machine with:

```ts
type JourneyExecutionPathsMachineExtension<TStepId extends string, TEventType extends string> = {
  getExecutionPaths: (
    options?: JourneyExecutionPathOptions
  ) => JourneyExecutionPathsResult<TStepId, TEventType>;
};
```

That result includes:

- `paths`: the structural paths discovered from the initial step
- `truncated`: whether traversal was cut short by limits
- `cyclesDetected`: whether cycles were encountered during traversal

Each path reports:

- ordered `steps`
- ordered `events`
- a termination reason of `final`, `depth`, `cycle`, or `limit`

## What It Is Good For

- reviewing graph complexity before shipping
- writing tests that assert the declared shape of a flow
- generating tooling or diagrams from a journey definition
- spotting unexpected cycles or dead ends in authored transitions

## What It Does Not Do

The plugin is structural, not behavioral.

It does not:

- run guards
- commit runtime context changes
- inspect live context values
- prove that a path is reachable under real runtime conditions

Think of it as “what the declared graph allows”, not “what a specific user will do at runtime”.

## Traversal Limits

Use traversal limits when the graph contains cycles or when you only need a bounded inspection:

```ts
const paths = machine.getExecutionPaths({
  maxDepth: 8,
  maxPaths: 50
});
```

This keeps graph inspection practical even for large flows.
