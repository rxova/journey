[**@rxova/journey-core**](../README.md)

---

[@rxova/journey-core](../README.md) / JourneySelector

# Type Alias: JourneySelector\<TContext, TStepId, TSelected\>

```ts
type JourneySelector<TContext, TStepId, TSelected> = (snapshot) => TSelected;
```

Defined in: [packages/core/src/types/journey.types.ts:211](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/journey.types.ts#L211)

Selector function that derives a value from a machine snapshot.

## Type Parameters

| Type Parameter                                                   | Default type |
| ---------------------------------------------------------------- | ------------ |
| `TContext` _extends_ [`JourneyJsonObject`](JourneyJsonObject.md) | -            |
| `TStepId` _extends_ `string`                                     | -            |
| `TSelected`                                                      | `unknown`    |

## Parameters

| Parameter  | Type                                                             |
| ---------- | ---------------------------------------------------------------- |
| `snapshot` | [`JourneySnapshot`](JourneySnapshot.md)\<`TContext`, `TStepId`\> |

## Returns

`TSelected`
