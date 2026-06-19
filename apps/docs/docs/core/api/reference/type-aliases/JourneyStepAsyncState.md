[**@rxova/journey-core**](../README.md)

---

[@rxova/journey-core](../README.md) / JourneyStepAsyncState

# Type Alias: JourneyStepAsyncState

```ts
type JourneyStepAsyncState = {
  error: unknown;
  eventType: string | null;
  phase: JourneyAsyncPhase;
  transitionId: string | null;
};
```

Defined in: [packages/core/src/types/journey.types.ts:54](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/journey.types.ts#L54)

Async execution state for a single step.

## Properties

### error

```ts
error: unknown;
```

Defined in: [packages/core/src/types/journey.types.ts:59](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/journey.types.ts#L59)

Captured error from a failed guard or lifecycle handler. `null` when no error is present.

---

### eventType

```ts
eventType: string | null;
```

Defined in: [packages/core/src/types/journey.types.ts:56](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/journey.types.ts#L56)

---

### phase

```ts
phase: JourneyAsyncPhase;
```

Defined in: [packages/core/src/types/journey.types.ts:55](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/journey.types.ts#L55)

---

### transitionId

```ts
transitionId: string | null;
```

Defined in: [packages/core/src/types/journey.types.ts:57](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/journey.types.ts#L57)
