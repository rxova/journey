[**@rxova/journey-core**](../README.md)

---

[@rxova/journey-core](../README.md) / JourneyTransitionArgsForEvent

# Type Alias: JourneyTransitionArgsForEvent\<TContext, TStepId, TEventMap, THandlers, TEventType\>

```ts
type JourneyTransitionArgsForEvent<TContext, TStepId, TEventMap, THandlers, TEventType> =
  JourneyTransitionArgsBase<TContext, TStepId, THandlers> & {
    event: JourneyTransitionEventOfType<TStepId, TEventMap, TEventType>;
  };
```

Defined in: [packages/core/src/types/transitions.types.ts:92](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/transitions.types.ts#L92)

## Type Declaration

| Name    | Type                                                                   | Defined in                                                                                                                                                                         |
| ------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `event` | `JourneyTransitionEventOfType`\<`TStepId`, `TEventMap`, `TEventType`\> | [packages/core/src/types/transitions.types.ts:99](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/transitions.types.ts#L99) |

## Type Parameters

| Type Parameter                                                                          |
| --------------------------------------------------------------------------------------- |
| `TContext` _extends_ [`JourneyJsonObject`](JourneyJsonObject.md)                        |
| `TStepId` _extends_ `string`                                                            |
| `TEventMap` _extends_ `Record`\<`string`, `unknown`\>                                   |
| `THandlers` _extends_ `Record`\<`string`, `unknown`\>                                   |
| `TEventType` _extends_ [`JourneyFullEventType`](JourneyFullEventType.md)\<`TEventMap`\> |
