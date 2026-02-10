# API

## Concepts

### `when` vs `effect` (most important distinction)

- `when`: decides whether a transition is allowed.
  - Return `true` to allow.
  - Return `false` to block.
  - Use this for validation/authorization checks.
- `effect`: runs side effects and can update context.
  - Return new context (or `void`) after work is done.
  - Use this for API calls, saving drafts, enrichment, etc.

Example:

```ts
{
  from: "payment",
  event: "next",
  to: "review",
  when: async ({ context }) => {
    // "when" answers: can we move to the step whose id is 'review'?
    return await validateCard(context.cardToken);
  },
  effect: async ({ context }) => {
    // "effect" does work and optionally updates context
    const draft = await saveDraft(context);
    return { ...context, draftId: draft.id };
  }
}
```

### Why `when` / `effect` can throw errors

Errors usually come from real app dependencies:

- Network/API failure
- Timeout / aborted request
- Unexpected server response format
- Thrown validation exceptions

When errors throw, journey does not silently ignore them:

- `send(...)` rejects
- step async state becomes `error`
- `snapshot.async.byStep[currentStep].error` stores the error

## Core

### `createJourneyMachine(journey)`

Creates a framework-agnostic machine.

- Input: `JourneyDefinition<TContext, TStepId, TEventType>`
- Optional second argument: `JourneyMachineOptions<TContext, TStepId>`
- Output: `JourneyMachine<TContext, TStepId, TEventType>`

Machine methods:

- `getSnapshot()`
- `send(event)` async
- `updateContext(updater)`
- `reset()`
- `subscribe(listener)`

Example:

```ts
import { createJourneyMachine } from "react-toolkit-journey/core";

const machine = createJourneyMachine(journey);
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

Important compatibility note:

- Persisted state includes `current`, `context`, `history`, `status`.
- Async UX state (`snapshot.async`) is runtime-only and is **not persisted**.
- On hydrate/reset, async state starts clean (`idle` / no error).

Persistence example:

```ts
const machine = createJourneyMachine(journey, {
  persistence: {
    key: "checkout-journey",
    version: 2,
    migrate: (oldSnapshot, oldVersion) => {
      if (oldVersion === 1) {
        const v1 = oldSnapshot as { context?: { draftId?: string } };
        return {
          current: "details",
          context: { draftId: v1.context?.draftId ?? null, acceptedTerms: false },
          history: ["start"],
          status: "running"
        };
      }
      return oldSnapshot as {
        current: "start" | "details" | "review";
        context: { draftId: string | null; acceptedTerms: boolean };
        history: Array<"start" | "details" | "review">;
        status: "running" | "complete" | "closed";
      };
    }
  }
});
```

### `HISTORY_TARGET`

Special transition target (`"__HISTORY__"`) that resolves to the latest visited step from history.

### `JOURNEY_TERMINAL`

Terminal constants:

- `JOURNEY_TERMINAL.COMPLETE`
- `JOURNEY_TERMINAL.CLOSE`

## React

### `<JourneyProvider journey={journey}>`

Binds a machine to React via `useSyncExternalStore`.

Notes:

- If `journey` object changes, a fresh internal machine is created.
- You can pass `machine` prop to use your own machine instance.
- You can pass `persistence` prop to configure machine persistence when using the internal machine.

Example:

```tsx
<JourneyProvider
  journey={journey}
  persistence={{
    key: "signup-journey",
    version: 1
  }}
>
  <JourneyStepRenderer />
</JourneyProvider>
```

### `<JourneyStepRenderer />`

Renders the component at `snapshot.current` using `journey.steps[current].component`.

### `useJourney()`

Returns `{ snapshot, api }`.

Snapshot:

- `current`
- `context`
- `history`
- `visited`
- `status` (`"running" | "complete" | "closed"`)
- `async`
  - `isLoading`: `true` while any step is evaluating async guards/effects
  - `byStep[stepId]`
    - `phase`: `idle` | `evaluating-when` | `running-effect` | `error`
    - `eventType`: event currently being processed for that step (if any)
    - `transitionId`: transition id being evaluated/executed (if present)
    - `error`: last async/sync thrown error captured for that step

Common UI pattern:

```tsx
const { snapshot, api } = useJourney<MyCtx, MySteps>();
const stepAsync = snapshot.async.byStep[snapshot.current];

if (stepAsync.phase === "evaluating-when" || stepAsync.phase === "running-effect") {
  return <Spinner />;
}

if (stepAsync.phase === "error") {
  return (
    <div>
      <p>Something went wrong.</p>
      <button onClick={() => api.clearStepError()}>Dismiss</button>
    </div>
  );
}
```

API:

- `send(event)`
- `goTo(stepId, payload?)`
- `next(payload?)`
- `back(payload?)`
- `close(payload?)`
- `submit(payload?)`
- `clearStepError(stepId?)`
- `updateContext(updater)`
- `reset()`

Example:

```tsx
const { snapshot, api } = useJourney<MyCtx, MySteps, "retry">();
await api.send({ type: "retry" });
await api.goTo("review");
api.updateContext((ctx) => ({ ...ctx, dirty: true }));
api.clearStepError(); // clear current step error
```

Type model:

- Default events are always available: `next`, `back`, `close`, `submit`.
- Add custom events through the third generic parameter.
- Optionally type payloads through a payload map generic (4th generic in React types).

```ts
type CustomEvent = "retry";
const { api } = useJourney<MyCtx, MySteps, CustomEvent>();
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

const { api } = useJourney<MyCtx, MySteps, CustomEvent, Payloads>();
await api.next({ source: "button" });
await api.send({ type: "retry", payload: { attempt: 2 } });
await api.goTo("review", { source: "shortcut" });
```
