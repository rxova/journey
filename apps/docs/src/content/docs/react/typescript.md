---
title: TypeScript Types
sidebar_position: 7
---

React keeps Core types intact and adds types for the linear bundle, its Provider props, and hook
results. Import full machine and definition contracts from `@rxova/journey-core`; import plugin
contracts from each plugin's dedicated entrypoint.

## Main entrypoint exports

`@rxova/journey-react` exports one runtime:

- `createLinearJourney`

Its primary React-specific types are:

| Type                                              | Purpose                                                         |
| ------------------------------------------------- | --------------------------------------------------------------- |
| `LinearJourneyBundle<TContext, TStepId>`          | Factory result: `Provider` and the hooks                        |
| `LinearJourneyBundleDefinition<TContext, TSteps>` | The `{ context, steps, name? }` definition the factory captures |
| `LinearJourneyBundleOptions<TStepId>`             | Core's `JourneyRuntimeOptions`, frozen per bundle               |
| `LinearProviderProps<TContext, TStepId>`          | Props for the bundle's Provider                                 |
| `LinearJourneyViews<TStepId>`                     | The Provider's `views` record: `{ [K in TStepId]: ReactNode }`  |
| `UseLinearJourneyResult<TContext, TStepId>`       | Hook result: `{ machine, snapshot }`                            |
| `LinearJourneySnapshot<TContext, TStepId>`        | Core linear snapshot with non-null `currentStep`                |
| `LinearJourneyMachine<TContext, TStepId>`         | Underlying Core machine, verbatim                               |
| `LinearJourneyEventPayloads<TContext, TStepId>`   | Core event payloads for the callback props                      |
| `LinearJourneyStepHandler<TContext, TResult>`     | Transactional navigation work                                   |

### Inference from the definition

Both type parameters come from the single definition argument: `TContext` is inferred from
`definition.context`, and the step-id union from the `steps` tuple — mixed bare-string and config
entries both contribute their literal ids.

```ts
type SignupContext = { email: string; accountId: string | null };

const initialContext: SignupContext = { email: "", accountId: null };

const signup = createLinearJourney({
  context: initialContext,
  steps: ["email", { id: "password" }, "review"]
});

// snapshot.currentStep.id and machine.navigate targets are "email" | "password" | "review"
```

Annotate the context variable; do not cast. An annotation checks the initial value against the
type and anchors `TContext` at the declared unions (`string | null`, not `null`), while an
`as SignupContext` cast would silence missing or mistyped fields.

There is no way to pass explicit type arguments to `createLinearJourney` — and no need. TypeScript
has no partial type-argument inference: an explicit `TContext` would also force spelling out the
whole steps tuple by hand. Inferring everything from the one definition argument sidesteps that,
which is why the factory takes an annotated context value as the type anchor instead of a generic.

The step tuple's literal ids type the whole bundle: the keys of the Provider's `views` record, its
`startAt` prop, and `machine.navigate` targets are all the declared union. Coverage is
compile-time checked too — `views` is `LinearJourneyViews<TStepId>`, a mapped
`{ [K in TStepId]: ReactNode }` record, so a missing key and an undeclared key are both TS errors.
The runtime check that remains (a missing key throws, an undeclared key is a development-mode
error) exists only for plain-JS callers.

`LinearJourneySnapshot` is Core's linear snapshot with one narrowing: `currentStep` is non-null,
because a rendered journey never observes the idle state (only `fallback` renders before start).

For imperative escape hatches such as `machineRef`, derive the machine type from the bundle:

```ts
type SignupMachine = ReturnType<typeof signup.useJourney>["machine"];
```

### Navigation work

```ts
const createAccount: LinearJourneyStepHandler<SignupContext, { accountId: string }> = {
  run: ({ snapshot }) => api.create(snapshot.context.email),
  commit: ({ result, updateContext }) => {
    updateContext((context) => ({ ...context, accountId: result.accountId }));
  }
};
```

The result type from `run` flows into `commit.result`. When the handler is written inline,
`signup.useStep({ ... })` infers `TResult` from `run`'s return type — no annotation needed.

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
`JourneyEventObject`, `JourneyEventPayloads`, `JourneyRuntimeOptions`,
`JourneySubscriptionEvent`, `NavigationResult`, `NavigationWork`, `JourneyPersistOption`,
`JourneyStatus`, `StepAsyncState`, `StepEnterDirection`, and `AnyJourneyPlugin`.

For definitions, builders, navigation work, hook arguments, plugin hosts, or less common contracts,
import directly from `@rxova/journey-core`.
