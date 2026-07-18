---
title: TypeScript Types
sidebar_position: 7
---

React keeps Core types intact and adds types for component props, typed bundles, and hook results.
Import full machine and definition contracts from `@rxova/journey-core`; import plugin contracts
from each plugin's dedicated entrypoint.

## Main entrypoint exports

`@rxova/journey-react` exports these runtimes:

- `LinearJourney`
- `LinearJourney.Step`
- `createLinearJourney`
- `useLinearJourney`
- `useLinearJourneySelector`
- `useLinearJourneyStep`

Its primary React-specific types are:

| Type                                          | Purpose                                     |
| --------------------------------------------- | ------------------------------------------- |
| `LinearJourneyProps<TContext, TStepId>`       | Props for the owning component              |
| `LinearJourneyStepProps<TContext, TStepId>`   | Config marker props                         |
| `UseLinearJourneyResult<TContext, TStepId>`   | Hook result: `{ machine, snapshot }`        |
| `LinearJourneySnapshot<TContext, TStepId>`    | Core linear snapshot alias                  |
| `LinearJourneyMachine<TContext, TStepId>`     | Underlying Core machine, verbatim           |
| `LinearJourneyEventPayloads<TContext>`        | Core event payloads for the callback props  |
| `LinearJourneyStepConfig<TContext>`           | `<LinearJourney.Step>` metadata/hook config |
| `LinearJourneyStepHandler<TContext, TResult>` | Transactional navigation work               |
| `LinearJourneyBundle<TContext, TStepId>`      | Typed factory result                        |
| `TypedLinearJourney<TContext, TStepId>`       | Typed component with `.Step`                |

### Literal step inference

```ts
type Context = { email: string };

const signup = createLinearJourney<Context>()(["email", "password", "review"] as const);

type Signup = ReturnType<typeof signup.useLinearJourney>;
// snapshot.currentStep?.id and machine.navigate targets are "email" | "password" | "review"
```

Keep the tuple literal with `as const`; widening it to `string[]` loses the step-ID union.

### Navigation work

```ts
const saveShipping: LinearJourneyStepHandler<Context, Shipping> = {
  run: ({ snapshot }) => api.save(snapshot.context),
  commit: ({ result, updateContext }) => {
    updateContext((context) => ({ ...context, shippingId: result.id }));
  }
};
```

The result type from `run` flows into `commit.result`.

## Graph entrypoint exports

`@rxova/journey-react/graph` exports:

- `createGraphJourney`
- `GraphJourneyBundle`
- `GraphProviderProps`

The factory infers context, step IDs, event objects, handlers, metadata, and the plugin tuple from the
Core definition and options.

```ts
const checkout = createGraphJourney(definition, {
  plugins: [createReplayPlugin()] as const
});

const api = checkout.useApi();
// api.send is narrowed to definition events
```

The plugin tuple remains present on `checkout.useMachine().plugins`.

## Headless entrypoint exports

`@rxova/journey-react/headless` exports:

- `useOwnedJourney`
- `useJourneySnapshot`
- `useJourneySelector`
- `useJourneyEvent`
- `useJourneyStepLifecycle`
- `useStepAsyncState`

It also exports `AnyJourneyMachine`, `ContextOf`, `SnapshotOf`, `StepIdOf`, and
`EventPayloadOf`.

```ts
useJourneyEvent(machine, "navigationBlocked", (payload) => {
  payload.reason;
  payload.error;
  payload.snapshot;
});
```

The event name selects the listener payload from Core's `JourneyEventPayloads`.

## Re-exported Core types

The main React entrypoint re-exports commonly consumed Core machine and snapshot types, including
`GraphJourneyMachine`, `GraphSnapshot`, `LinearSnapshot`, `JourneySnapshot`,
`JourneyEventObject`, `JourneyEventPayloads`, `JourneySubscriptionEvent`, `NavigationResult`,
`NavigationWork`, `JourneyPersistOption`, `JourneyStatus`, `StepAsyncState`, and
`StepEnterDirection`.

For definitions, builders, navigation work, hook arguments, plugin hosts, or less common contracts,
import directly from `@rxova/journey-core`.
