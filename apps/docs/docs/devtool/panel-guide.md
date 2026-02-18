---
title: Panel Guide
sidebar_position: 4
---

This page explains every panel section and how to use it during real debugging.

## 1) Connection Card

Shows whether the inspected tab is actively receiving bridge envelopes.

Interpretation:

- `Connected`: bridge is attached and message pipeline is healthy.
- `Waiting for bridge messages`: extension loaded, but no machine is attached yet.

## 2) Machine Selector

When multiple machines exist in a page, selector lets you switch active context.

Tips:

- Use explicit `label` + `machineId` in bridge setup.
- Keep one machine per business domain for easier debugging.

## 3) Snapshot Tabs

### Current/Status

Best for quick state validation.

- `current`: active step id
- `status`: `running | complete | closed`
- `isLoading`: aggregate async flag

### Context

Full context object from runtime snapshot.

### History

Back-stack source used by `HISTORY_TARGET`.

### Visited

Unique ordered trail of reached steps.

### Async

Per-step async phases and errors.

## 4) Command Controls

Use controls to actively probe flow behavior.

Built-ins:

- `next`, `back`, `close`, `submit`, `reset`, `clearHistory`

Forms:

- `goTo` target step
- custom event send with JSON payload
- optional step for `clearStepError`
- optional numeric value for `trimHistory`

Command UI screenshot:

![Journey Devtools Command Controls](/img/devtool/panel-commands.png)

## 5) Event Log

Log captures envelope-level runtime events.

Includes:

- timestamp
- envelope kind
- summary

You can:

- leave logs unbounded
- set display limit
- prune stored logs to current limit

Log screenshot:

![Journey Devtools Event Log](/img/devtool/panel-logs.png)

## Recommended Debugging Workflow

1. Start with `Current/Status` tab.
2. Trigger UI action in app.
3. Confirm snapshot and log progression.
4. Use command controls to test branch edges.
5. Check async tab for guard/effect errors.
6. Validate back behavior via history/visited tabs.

## High-Value Debug Scenarios

- Guard ordering issues (first-match-wins mistakes)
- Unexpected terminal lock behavior
- History trimming side effects
- Async errors that are swallowed in app UI
- Mis-typed custom event payloads
