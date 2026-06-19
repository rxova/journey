[**@rxova/journey-core**](../README.md)

---

[@rxova/journey-core](../README.md) / LinearJourneyMachine

# Type Alias: LinearJourneyMachine\<TContext, TStepId, TStepMeta, THandlers, TPlugins\>

```ts
type LinearJourneyMachine<TContext, TStepId, TStepMeta, THandlers, TPlugins> =
  JourneyMachineWithPlugins<
    TContext,
    TStepId,
    Record<never, never>,
    TStepMeta,
    THandlers,
    TPlugins
  > & {
    goToStepByIndex: (index) => Promise<JourneySendResult<TContext, TStepId>>;
  };
```

Defined in: [packages/core/src/types/machine.types.ts:333](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/machine.types.ts#L333)

Linear journey machine — base machine plus index-based navigation.

## Type Declaration

| Name                | Type                                                                                           | Defined in                                                                                                                                                                   |
| ------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `goToStepByIndex()` | (`index`) => `Promise`\<[`JourneySendResult`](JourneySendResult.md)\<`TContext`, `TStepId`\>\> | [packages/core/src/types/machine.types.ts:347](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/machine.types.ts#L347) |

## Type Parameters

| Type Parameter                                                                    | Default type                                                 |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `TContext` _extends_ [`JourneyJsonObject`](JourneyJsonObject.md)                  | -                                                            |
| `TStepId` _extends_ `string`                                                      | -                                                            |
| `TStepMeta`                                                                       | `unknown`                                                    |
| `THandlers` _extends_ `Record`\<`string`, `unknown`\>                             | `Record`\<`never`, `never`\>                                 |
| `TPlugins` _extends_ readonly [`JourneyMachinePlugin`](JourneyMachinePlugin.md)[] | readonly [`JourneyMachinePlugin`](JourneyMachinePlugin.md)[] |
