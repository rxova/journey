[**@rxova/journey-core**](../README.md)

---

[@rxova/journey-core](../README.md) / JourneyExecutionPathsResult

# Type Alias: JourneyExecutionPathsResult\<TStepId, TEventType\>

```ts
type JourneyExecutionPathsResult<TStepId, TEventType> = {
  cyclesDetected: boolean;
  paths: JourneyExecutionPath<TStepId, TEventType>[];
  truncated: boolean;
};
```

Defined in: [packages/core/src/types/journey.types.ts:324](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/journey.types.ts#L324)

Result returned by structural path enumeration.

## Type Parameters

| Type Parameter                  |
| ------------------------------- |
| `TStepId` _extends_ `string`    |
| `TEventType` _extends_ `string` |

## Properties

### cyclesDetected

```ts
cyclesDetected: boolean;
```

Defined in: [packages/core/src/types/journey.types.ts:327](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/journey.types.ts#L327)

---

### paths

```ts
paths: (JourneyExecutionPath < TStepId, TEventType > []);
```

Defined in: [packages/core/src/types/journey.types.ts:325](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/journey.types.ts#L325)

---

### truncated

```ts
truncated: boolean;
```

Defined in: [packages/core/src/types/journey.types.ts:326](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/journey.types.ts#L326)
