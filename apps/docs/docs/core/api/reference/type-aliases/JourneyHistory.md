[**@rxova/journey-core**](../README.md)

---

[@rxova/journey-core](../README.md) / JourneyHistory

# Type Alias: JourneyHistory\<TStepId\>

```ts
type JourneyHistory<TStepId> = {
  index: number;
  timeline: readonly TStepId[];
};
```

Defined in: [packages/core/src/types/journey.types.ts:138](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/journey.types.ts#L138)

Timeline of visited steps and current history index.

## Type Parameters

| Type Parameter               |
| ---------------------------- |
| `TStepId` _extends_ `string` |

## Properties

### index

```ts
index: number;
```

Defined in: [packages/core/src/types/journey.types.ts:140](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/journey.types.ts#L140)

---

### timeline

```ts
timeline: readonly TStepId[];
```

Defined in: [packages/core/src/types/journey.types.ts:139](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/journey.types.ts#L139)
