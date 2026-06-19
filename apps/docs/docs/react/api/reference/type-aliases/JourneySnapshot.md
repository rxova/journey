[**@rxova/journey-react**](../README.md)

---

[@rxova/journey-react](../README.md) / JourneySnapshot

# Type Alias: JourneySnapshot\<TContext, TStepId\>

```ts
type JourneySnapshot<TContext, TStepId> = JourneySnapshotStateBase<TContext, TStepId> & object;
```

Defined in: [core/src/types/journey.types.ts:153](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/journey.types.ts#L153)

Serializable runtime snapshot of the journey state.

## Type Declaration

### async

```ts
async: JourneyAsyncState<TStepId>;
```

## Type Parameters

| Type Parameter                           |
| ---------------------------------------- |
| `TContext` _extends_ `JourneyJsonObject` |
| `TStepId` _extends_ `string`             |
