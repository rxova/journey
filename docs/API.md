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

Example:

```ts
import { createFlowMachine } from "react-toolkit-flow/core";

const machine = createFlowMachine(flow);
await machine.send({ type: "next" });
const snapshot = machine.getSnapshot();
```

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

Persistence example:

```ts
const machine = createFlowMachine(flow, {
  persistence: {
    key: "checkout-flow",
    version: 2,
    migrate: (oldSnapshot, oldVersion) => {
      if (oldVersion === 1) {
        const v1 = oldSnapshot as { context?: { draftId?: string } };
        return {
          current: "details",
          context: { draftId: v1.context?.draftId ?? null, acceptedTerms: false },
          history: ["start"],
          terminal: null
        };
      }
      return oldSnapshot as {
        current: "start" | "details" | "review";
        context: { draftId: string | null; acceptedTerms: boolean };
        history: Array<"start" | "details" | "review">;
        terminal: "COMPLETE" | "CLOSE" | null;
      };
    }
  }
});
```

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

Example:

```tsx
<FlowProvider
  flow={flow}
  persistence={{
    key: "signup-flow",
    version: 1
  }}
>
  <FlowStepRenderer />
</FlowProvider>
```

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
- `runtime`
  - `phase`: `idle` | `evaluating-when` | `running-effect`
  - `eventType`: currently processed event type while async work is pending
  - `transitionId`: transition id currently being evaluated/executed (if present)
  - `transitionIndex`: matched transition index in `transitions` array

API:

- `send(event)`
- `goTo(stepId, payload?)`
- `next(payload?)`
- `back(payload?)`
- `close(payload?)`
- `submit(payload?)`
- `updateContext(updater)`
- `reset()`

Example:

```tsx
const { snapshot, api } = useFlow<MyCtx, MySteps, "retry">();
await api.send({ type: "retry" });
await api.goTo("review");
api.updateContext((ctx) => ({ ...ctx, dirty: true }));
```

Type model:

- Default events are always available: `next`, `back`, `close`, `submit`.
- Add custom events through the third generic parameter.
- Optionally type payloads through a payload map generic (4th generic in React types).

```ts
type CustomEvent = "retry";
const { api } = useFlow<MyCtx, MySteps, CustomEvent>();
api.send({ type: "retry" });
```

Typed payload map example:

```ts
type CustomEvent = "retry";
type Payloads = {
  next: { source: "button" | "enter" };
  retry: { attempt: number };
  goTo: { source: "deep-link" | "shortcut" };
};

const { api } = useFlow<MyCtx, MySteps, CustomEvent, Payloads>();
await api.next({ source: "button" });
await api.send({ type: "retry", payload: { attempt: 2 } });
await api.goTo("review", { source: "shortcut" });
```
