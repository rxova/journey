[**@rxova/journey-react**](../README.md)

---

[@rxova/journey-react](../README.md) / LinearJourneyRuntime

# Type Alias: LinearJourneyRuntime\<TContext, TStepId, TStepMeta, TPlugins, THandlers\>

```ts
type LinearJourneyRuntime<TContext, TStepId, TStepMeta, TPlugins, THandlers> = Omit<
  JourneyRuntime<TContext, TStepId, Record<never, never>, TStepMeta, TPlugins, THandlers>,
  "machine"
> &
  object;
```

Defined in: [react/src/types.ts:111](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/react/src/types.ts#L111)

React runtime for a linear journey — `machine` carries `goToStepByIndex`.

## Type Declaration

### machine

```ts
machine: LinearJourneyMachine<TContext, TStepId, TStepMeta, THandlers, TPlugins>;
```

## Type Parameters

| Type Parameter                                                                    | Default type                 |
| --------------------------------------------------------------------------------- | ---------------------------- |
| `TContext` _extends_ `JourneyJsonObject`                                          | -                            |
| `TStepId` _extends_ `string`                                                      | -                            |
| `TStepMeta`                                                                       | `unknown`                    |
| `TPlugins` _extends_ readonly [`JourneyMachinePlugin`](JourneyMachinePlugin.md)[] | \[\]                         |
| `THandlers` _extends_ `Record`\<`string`, `unknown`\>                             | `Record`\<`never`, `never`\> |
