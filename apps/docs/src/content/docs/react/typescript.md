---
title: "TypeScript Types"
---

React keeps Core types intact and adds types for the linear bundle, its Provider props, and hook
results. Import full machine and definition contracts from `@rxova/journey-core`; import plugin
contracts from each plugin's dedicated entrypoint.

## Main entrypoint exports

`@rxova/journey-react` exports one runtime:

- `createLinearJourney`

Its primary React-specific types are:

| Type                                              | Purpose                                                                     |
| ------------------------------------------------- | --------------------------------------------------------------------------- |
| `LinearJourneyBundle<TContext, TStepId>`          | Factory result: `machine`, `Provider`, `StepRenderer`, hooks, and delegates |
| `LinearJourneyBundleDefinition<TContext, TSteps>` | The `{ context, steps, name? }` definition the factory captures             |
| `LinearJourneyBundleOptions<TStepId>`             | Core's `JourneyRuntimeOptions`, frozen per bundle                           |
| `JourneyProviderProps<TStepId>`                   | The Provider's props: `{ views, children }` — shared by both tiers          |
| `JourneyViews<TStepId>`                           | The `views` record: `{ [K in TStepId]: ReactNode }` — shared by both tiers  |
| `LinearJourneySnapshot<TContext, TStepId>`        | Core linear snapshot, verbatim — `currentStep` null while idle              |
| `LinearJourneyMachine<TContext, TStepId>`         | Underlying Core machine, verbatim                                           |
| `LinearJourneyEventPayloads<TContext, TStepId>`   | Core event payloads, as `useSubscribeEvent` listeners receive them          |
| `LinearJourneyStepHandler<TContext, TResult>`     | Transactional navigation work for `useStepHandler`                          |

It also exports the structural helpers `AnyJourneyMachine`, `SnapshotOf`, `ContextOf`,
`StepIdOf`, and `EventPayloadOf` for typing wrappers around
[caller-owned machines](#typing-caller-owned-machines).

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

// snapshot.currentStep?.id and machine.navigate targets are "email" | "password" | "review"
```

Annotate the context variable; do not cast. An annotation checks the initial value against the
type and anchors `TContext` at the declared unions (`string | null`, not `null`), while an
`as SignupContext` cast would silence missing or mistyped fields.

There is no way to pass explicit type arguments to `createLinearJourney` — and no need. TypeScript
has no partial type-argument inference: an explicit `TContext` would also force spelling out the
whole steps tuple by hand. Inferring everything from the one definition argument sidesteps that,
which is why the factory takes an annotated context value as the type anchor instead of a generic.

The step tuple's literal ids type the whole bundle: the keys of the Provider's `views` record, the
factory options' `startAt`, `useStepHandler`'s step-id argument, and `machine.navigate` targets
are all the declared union. Coverage is compile-time checked too — `views` is
`JourneyViews<TStepId>`, a mapped `{ [K in TStepId]: ReactNode }` record, so a missing key
and an undeclared key are both TS errors; there is no runtime assertion (in plain JS, an absent
key makes `StepRenderer` render its `fallback`).

`LinearJourneySnapshot` is Core's linear snapshot, verbatim: `currentStep` is `null` while the
machine is idle (`autoStart: false` before `controls.start()`), exactly as in the graph tier —
read it with the optional chain or an explicit null check.

For integrations and escape hatches, the machine is a plain property on the bundle:

```ts
type SignupMachine = typeof signup.machine;
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
`signup.useStepHandler("email", { ... })` infers `TResult` from `run`'s return type — no
annotation needed.

## Graph entrypoint exports

`@rxova/journey-react/graph` exports:

- `createGraphJourney`
- `GraphJourneyBundle`
- `JourneyViews`
- `JourneyProviderProps`
- `JourneyStepRendererProps`

The factory infers context, step IDs, event objects, handlers, metadata, and the plugin tuple from the
Core definition and options; the factory creates the bundle's standalone machine, and every hook
and delegate is pre-bound to those inferred types.

```ts
const checkout = createGraphJourney(definition, {
  plugins: [createReplayPlugin()] as const
});

await checkout.send("continue");
// send is narrowed to definition events — callable from React or anywhere else
```

`JourneyViews<TStepId>` is the same mapped `{ [K in TStepId]: ReactNode }` record in both tiers,
so `views` exhaustiveness is compile-time checked. `JourneyProviderProps<TStepId>` is just
`{ views, children }` — the Provider carries no machine props. The plugin tuple remains
present on `checkout.machine.plugins`.

## Typing caller-owned machines

There is no headless hook package — a caller-owned Core machine is consumed with React's own
`useSyncExternalStore`. The main entrypoint's structural helpers type any wrapper you build around
one: `AnyJourneyMachine` is the machine surface every Core `create*Journey` result satisfies, and
`SnapshotOf<TMachine>`, `ContextOf<TMachine>`, `StepIdOf<TMachine>`, and
`EventPayloadOf<TMachine, TEvent>` infer the concrete types from the machine you pass.

```ts
import type { AnyJourneyMachine, EventPayloadOf, SnapshotOf } from "@rxova/journey-react";

const useJourneySnapshot = <TMachine extends AnyJourneyMachine>(
  machine: TMachine
): SnapshotOf<TMachine> => {
  const subscribe = React.useCallback(
    (onStoreChange: () => void) =>
      machine.subscriptions.subscribeSelector((snapshot) => snapshot, onStoreChange),
    [machine]
  );
  const getSnapshot = React.useCallback(
    () => machine.getSnapshot() as SnapshotOf<TMachine>,
    [machine]
  );
  return React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
};

const onBlocked = (payload: EventPayloadOf<typeof machine, "navigationBlocked">) => {
  payload.reason;
  payload.error;
  payload.snapshot;
};
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
