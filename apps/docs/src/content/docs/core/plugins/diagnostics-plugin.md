---
title: "Diagnostics Plugin"
---

# Diagnostics Plugin

The diagnostics plugin adds structural analysis helpers to a machine.

It does not inspect live runtime state. It analyzes the journey definition and reports issues that are useful during authoring, testing, CI validation, or tooling.

## Install And Use

```ts
import { createJourneyMachine } from "@rxova/journey-core";
import { createDiagnosticsPlugin } from "@rxova/journey-core/diagnostics";

const machine = createJourneyMachine(journey, {
  plugins: [createDiagnosticsPlugin()]
});

const diagnostics = machine.getDiagnostics({
  requireExplicitCompletion: true
});
```

## What You Get

The plugin augments the machine with:

```ts
machine.getDiagnostics(options);
```

That result includes:

- `issues`: ordered structural findings
- `summary`: aggregate counts and mode metadata

## Issue Types

The current diagnostics codes are:

- `cycle-detected`
- `dead-end-step`
- `duplicate-transition-id`
- `no-terminal-path`
- `shadowed-transition`
- `unreachable-step`

Issue severities are either `warning` or `error`.

Depending on the finding, an issue may include `stepId`, `from`, `eventType`, `transitionId`, `label`, or `steps`.

## Summary Fields

The diagnostics summary reports:

- `mode`
- `stepCount`
- `reachableStepCount`
- `unreachableStepCount`
- `deadEndCount`
- `cycleCount`
- `shadowedTransitionCount`
- `graphChecksSkipped`
- `terminalPathExists`

## Options

- `requireExplicitCompletion`: when `true`, the last step in a linear journey is not treated as an implicit terminal path

That option matters for teams that require explicit terminal transitions instead of relying on linear auto-completion.

## What It Checks

- unreachable declared steps
- reachable dead ends with no outgoing transition or terminal exit
- unconditional transitions that shadow later transitions for the same `from + event`
- cycles in the declared graph
- whether any terminal path is reachable from the initial step

For headless journeys, graph-only checks are skipped and `summary.graphChecksSkipped` is `true`.
