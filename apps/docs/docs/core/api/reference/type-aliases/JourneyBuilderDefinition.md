[**@rxova/journey-core**](../README.md)

---

[@rxova/journey-core](../README.md) / JourneyBuilderDefinition

# Type Alias: JourneyBuilderDefinition\<TContext, TStepId, TEventMap, TStepMeta, THandlers, TStepHandledCustomEventMap, TGlobalHandledCustomEventType\>

```ts
type JourneyBuilderDefinition<
  TContext,
  TStepId,
  TEventMap,
  TStepMeta,
  THandlers,
  TStepHandledCustomEventMap,
  TGlobalHandledCustomEventType
> = JourneyDefinition<TContext, TStepId, TEventMap, TStepMeta, THandlers> &
  JourneyBuilderDefinitionMetadata<
    TStepId,
    TEventMap,
    TStepHandledCustomEventMap,
    TGlobalHandledCustomEventType
  >;
```

Defined in: [packages/core/src/journey-builder/types.ts:360](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/journey-builder/types.ts#L360)

## Type Parameters

| Type Parameter                                                                                                                                 | Default type                   |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| `TContext` _extends_ [`JourneyJsonObject`](JourneyJsonObject.md)                                                                               | -                              |
| `TStepId` _extends_ `string`                                                                                                                   | -                              |
| `TEventMap` _extends_ `Record`\<`string`, `unknown`\>                                                                                          | -                              |
| `TStepMeta`                                                                                                                                    | `unknown`                      |
| `THandlers` _extends_ `Record`\<`string`, `unknown`\>                                                                                          | `Record`\<`never`, `never`\>   |
| `TStepHandledCustomEventMap` _extends_ `Record`\<`TStepId`, [`JourneyBuilderCustomEventKey`](JourneyBuilderCustomEventKey.md)\<`TEventMap`\>\> | `Record`\<`TStepId`, `never`\> |
| `TGlobalHandledCustomEventType` _extends_ [`JourneyBuilderCustomEventKey`](JourneyBuilderCustomEventKey.md)\<`TEventMap`\>                     | `never`                        |
