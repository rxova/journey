[**@rxova/journey-core**](../README.md)

---

[@rxova/journey-core](../README.md) / JourneyTerminateObservationEvent

# Type Alias: JourneyTerminateObservationEvent\<TStepId\>

```ts
type JourneyTerminateObservationEvent<TStepId> = {
  stepId: TStepId;
  timestamp: number;
  type: "journey.terminated";
};
```

Defined in: [packages/core/src/types/observation.types.ts:81](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/observation.types.ts#L81)

## Type Parameters

| Type Parameter               |
| ---------------------------- |
| `TStepId` _extends_ `string` |

## Properties

### stepId

```ts
stepId: TStepId;
```

Defined in: [packages/core/src/types/observation.types.ts:83](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/observation.types.ts#L83)

---

### timestamp

```ts
timestamp: number;
```

Defined in: [packages/core/src/types/observation.types.ts:84](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/observation.types.ts#L84)

---

### type

```ts
type: "journey.terminated";
```

Defined in: [packages/core/src/types/observation.types.ts:82](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/observation.types.ts#L82)
