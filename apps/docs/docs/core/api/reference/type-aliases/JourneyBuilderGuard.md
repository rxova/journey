[**@rxova/journey-core**](../README.md)

---

[@rxova/journey-core](../README.md) / JourneyBuilderGuard

# Type Alias: JourneyBuilderGuard\<TContext, TStepId, TEventMap, THandlers, TEventType\>

```ts
type JourneyBuilderGuard<TContext, TStepId, TEventMap, THandlers, TEventType> = (
  args
) => boolean | Promise<boolean>;
```

Defined in: [packages/core/src/journey-builder/types.ts:28](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/journey-builder/types.ts#L28)

## Type Parameters

| Type Parameter                                                                          | Default type                                                     |
| --------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `TContext` _extends_ [`JourneyJsonObject`](JourneyJsonObject.md)                        | -                                                                |
| `TStepId` _extends_ `string`                                                            | -                                                                |
| `TEventMap` _extends_ `Record`\<`string`, `unknown`\>                                   | -                                                                |
| `THandlers` _extends_ `Record`\<`string`, `unknown`\>                                   | -                                                                |
| `TEventType` _extends_ [`JourneyFullEventType`](JourneyFullEventType.md)\<`TEventMap`\> | [`JourneyFullEventType`](JourneyFullEventType.md)\<`TEventMap`\> |

## Parameters

| Parameter | Type                                                                                                                                 |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `args`    | [`JourneyTransitionArgsForEvent`](JourneyTransitionArgsForEvent.md)\<`TContext`, `TStepId`, `TEventMap`, `THandlers`, `TEventType`\> |

## Returns

`boolean` \| `Promise`\<`boolean`\>
