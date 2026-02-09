# API

## Core

### `createFlowMachine(flow)`

Creates a framework-agnostic machine.

- Input: `FlowFlow<TContext, TStepId, TEventType>`
- Optional second argument: `FlowMachineOptions<TContext, TStepId>`
- Output: `FlowMachine<TContext, TStepId, TEventType>`

Machine methods:

- `getSnapshot()`
- `send(event)` async
- `updateContext(updater)`
- `reset()`
- `subscribe(listener)`

`send` behavior:

- Calls are serialized. Rapid multi-click scenarios are processed in order.
- The first matching transition in `transitions` array order is selected.
- If no transition matches, `transitioned` is `false`.

Persistence options (`options.persistence`):

- `key`: storage key.
- `storage`: custom storage adapter (`getItem`, `setItem`, `removeItem`). Defaults to `localStorage` when available.
- `version`: persisted schema version (default `1`).
- `migrate`: migrate older persisted snapshots to current shape.
- `clearOnReset`: when `true` (default), `reset()` removes persisted state.
- `serialize` / `deserialize`: custom serialization functions.
- `onError`: receives persistence read/write/parse errors.

### `HISTORY_TARGET`

Special transition target (`"__HISTORY__"`) that resolves to the latest visited step from history.

### `FLOW_TERMINAL`

Terminal constants:

- `FLOW_TERMINAL.COMPLETE`
- `FLOW_TERMINAL.CLOSE`

## React

### `<FlowProvider flow={flow}>`

Binds a machine to React via `useSyncExternalStore`.

Notes:

- If `flow` object changes, a fresh internal machine is created.
- You can pass `machine` prop to use your own machine instance.
- You can pass `persistence` prop to configure machine persistence when using the internal machine.

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

Type model:

- Default events are always available: `next`, `back`, `close`, `submit`.
- Add custom events through the third generic parameter.

```ts
type CustomEvent = "retry";
const { api } = useFlow<MyCtx, MySteps, CustomEvent>();
api.send({ type: "retry" });
```
