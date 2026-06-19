[**@rxova/journey-react**](../README.md)

---

[@rxova/journey-react](../README.md) / JourneyBuilderRuntime

# Type Alias: JourneyBuilderRuntime\<TContext, TStepId, TEventMap, TStepMeta, TPlugins, THandlers, TStepHandledCustomEventMap, TGlobalHandledCustomEventType\>

```ts
type JourneyBuilderRuntime<
  TContext,
  TStepId,
  TEventMap,
  TStepMeta,
  TPlugins,
  THandlers,
  TStepHandledCustomEventMap,
  TGlobalHandledCustomEventType
> = JourneyRuntimeWithStepApi<
  TContext,
  TStepId,
  TEventMap,
  TStepMeta,
  TPlugins,
  THandlers,
  TStepHandledCustomEventMap,
  TGlobalHandledCustomEventType
>;
```

Defined in: [react/src/types.ts:149](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/react/src/types.ts#L149)

## Type Parameters

| Type Parameter                                                                                              | Default type                   |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------ |
| `TContext` _extends_ `JourneyJsonObject`                                                                    | -                              |
| `TStepId` _extends_ `string`                                                                                | -                              |
| `TEventMap` _extends_ `Record`\<`string`, `unknown`\>                                                       | `Record`\<`never`, `never`\>   |
| `TStepMeta`                                                                                                 | `unknown`                      |
| `TPlugins` _extends_ readonly [`JourneyMachinePlugin`](JourneyMachinePlugin.md)[]                           | \[\]                           |
| `THandlers` _extends_ `Record`\<`string`, `unknown`\>                                                       | `Record`\<`never`, `never`\>   |
| `TStepHandledCustomEventMap` _extends_ `Record`\<`TStepId`, `JourneyBuilderCustomEventKey`\<`TEventMap`\>\> | `Record`\<`TStepId`, `never`\> |
| `TGlobalHandledCustomEventType` _extends_ `JourneyBuilderCustomEventKey`\<`TEventMap`\>                     | `never`                        |
