[**@rxova/journey-core**](../README.md)

---

[@rxova/journey-core](../README.md) / JourneyCompleteObservationEvent

# Type Alias: JourneyCompleteObservationEvent\<TStepId\>

```ts
type JourneyCompleteObservationEvent<TStepId> = {
  stepId: TStepId;
  timestamp: number;
  type: "journey.completed";
};
```

Defined in: [packages/core/src/types/observation.types.ts:75](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/observation.types.ts#L75)

## Type Parameters

| Type Parameter               |
| ---------------------------- |
| `TStepId` _extends_ `string` |

## Properties

### stepId

```ts
stepId: TStepId;
```

Defined in: [packages/core/src/types/observation.types.ts:77](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/observation.types.ts#L77)

---

### timestamp

```ts
timestamp: number;
```

Defined in: [packages/core/src/types/observation.types.ts:78](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/observation.types.ts#L78)

---

### type

```ts
type: "journey.completed";
```

Defined in: [packages/core/src/types/observation.types.ts:76](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/observation.types.ts#L76)
