[**@rxova/journey-core**](../README.md)

---

[@rxova/journey-core](../README.md) / JourneySnapshot

# Type Alias: JourneySnapshot\<TContext, TStepId\>

```ts
type JourneySnapshot<TContext, TStepId> = JourneySnapshotStateBase<TContext, TStepId> & {
  async: JourneyAsyncState<TStepId>;
};
```

Defined in: [packages/core/src/types/journey.types.ts:153](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/journey.types.ts#L153)

Serializable runtime snapshot of the journey state.

## Type Declaration

| Name    | Type                                                     | Defined in                                                                                                                                                                   |
| ------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `async` | [`JourneyAsyncState`](JourneyAsyncState.md)\<`TStepId`\> | [packages/core/src/types/journey.types.ts:157](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/journey.types.ts#L157) |

## Type Parameters

| Type Parameter                                                   |
| ---------------------------------------------------------------- |
| `TContext` _extends_ [`JourneyJsonObject`](JourneyJsonObject.md) |
| `TStepId` _extends_ `string`                                     |
