[**@rxova/journey-react**](../README.md)

---

[@rxova/journey-react](../README.md) / JourneyRuntimeFactory

# Type Alias: JourneyRuntimeFactory\<TContext, TStepId, TEventMap, TStepMeta, TPlugins, THandlers\>

```ts
type JourneyRuntimeFactory<TContext, TStepId, TEventMap, TStepMeta, TPlugins, THandlers> =
  () => JourneyRuntime<TContext, TStepId, TEventMap, TStepMeta, TPlugins, THandlers>;
```

Defined in: [react/src/types.ts:237](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/react/src/types.ts#L237)

## Type Parameters

| Type Parameter                                                                    | Default type                 |
| --------------------------------------------------------------------------------- | ---------------------------- |
| `TContext` _extends_ `JourneyJsonObject`                                          | -                            |
| `TStepId` _extends_ `string`                                                      | -                            |
| `TEventMap` _extends_ `Record`\<`string`, `unknown`\>                             | `Record`\<`never`, `never`\> |
| `TStepMeta`                                                                       | `unknown`                    |
| `TPlugins` _extends_ readonly [`JourneyMachinePlugin`](JourneyMachinePlugin.md)[] | \[\]                         |
| `THandlers` _extends_ `Record`\<`string`, `unknown`\>                             | `Record`\<`never`, `never`\> |

## Returns

[`JourneyRuntime`](JourneyRuntime.md)\<`TContext`, `TStepId`, `TEventMap`, `TStepMeta`, `TPlugins`, `THandlers`\>
