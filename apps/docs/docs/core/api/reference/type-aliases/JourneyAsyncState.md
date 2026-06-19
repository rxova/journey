[**@rxova/journey-core**](../README.md)

---

[@rxova/journey-core](../README.md) / JourneyAsyncState

# Type Alias: JourneyAsyncState\<TStepId\>

```ts
type JourneyAsyncState<TStepId> = {
  byStep: Record<TStepId, JourneyStepAsyncState>;
  isLoading: boolean;
};
```

Defined in: [packages/core/src/types/journey.types.ts:63](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/journey.types.ts#L63)

Aggregated async state for the machine, keyed by step id.

## Type Parameters

| Type Parameter               |
| ---------------------------- |
| `TStepId` _extends_ `string` |

## Properties

### byStep

```ts
byStep: Record<TStepId, JourneyStepAsyncState>;
```

Defined in: [packages/core/src/types/journey.types.ts:65](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/journey.types.ts#L65)

---

### isLoading

```ts
isLoading: boolean;
```

Defined in: [packages/core/src/types/journey.types.ts:64](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/journey.types.ts#L64)
