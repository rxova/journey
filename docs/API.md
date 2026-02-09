# API

## Core

### `createFlowMachine(flow)`
Creates a framework-agnostic machine.

- Input: `FlowFlow<TContext, TStepId, TEventType>`
- Output: `FlowMachine<TContext, TStepId, TEventType>`

Machine methods:

- `getSnapshot()`
- `send(event)` async
- `updateContext(updater)`
- `reset()`
- `subscribe(listener)`

### `HISTORY_TARGET`
Special transition target (`"__HISTORY__"`) that resolves to the latest visited step from history.

### `FLOW_TERMINAL`
Terminal constants:

- `FLOW_TERMINAL.COMPLETE`
- `FLOW_TERMINAL.CLOSE`

## React

### `<FlowProvider flow={flow}>`
Binds a machine to React via `useSyncExternalStore`.

### `<FlowStepRenderer />`
Renders the component at `snapshot.current` using `flow.steps[current].component`.

### `useFlow()`
Returns `{ snapshot, api }`.

Snapshot:

- `current`
- `context`
- `history`
- `visited`
- `terminal`
- `isDone`

API:

- `send(event)`
- `goTo(stepId, payload?)`
- `next(payload?)`
- `back(payload?)`
- `close(payload?)`
- `submit(payload?)`
- `updateContext(updater)`
- `reset()`
