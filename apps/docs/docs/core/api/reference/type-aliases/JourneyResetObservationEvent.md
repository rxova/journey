[**@rxova/journey-core**](../README.md)

---

[@rxova/journey-core](../README.md) / JourneyResetObservationEvent

# Type Alias: JourneyResetObservationEvent\<TStepId\>

```ts
type JourneyResetObservationEvent<TStepId> = {
  stepId: TStepId;
  timestamp: number;
  type: "journey.reset";
};
```

Defined in: [packages/core/src/types/observation.types.ts:15](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/observation.types.ts#L15)

## Type Parameters

| Type Parameter               |
| ---------------------------- |
| `TStepId` _extends_ `string` |

## Properties

### stepId

```ts
stepId: TStepId;
```

Defined in: [packages/core/src/types/observation.types.ts:17](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/observation.types.ts#L17)

---

### timestamp

```ts
timestamp: number;
```

Defined in: [packages/core/src/types/observation.types.ts:18](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/observation.types.ts#L18)

---

### type

```ts
type: "journey.reset";
```

Defined in: [packages/core/src/types/observation.types.ts:16](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/observation.types.ts#L16)
