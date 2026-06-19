[**@rxova/journey-core**](../README.md)

---

[@rxova/journey-core](../README.md) / JourneyLifecycleErrorObservationEvent

# Type Alias: JourneyLifecycleErrorObservationEvent\<TStepId\>

```ts
type JourneyLifecycleErrorObservationEvent<TStepId> = {
  error: unknown;
  eventType: string;
  from: TStepId;
  label?: string;
  phase: JourneyLifecycleErrorPhase;
  timestamp: number;
  to: TStepId | JourneyTerminal;
  transitionId: string | null;
  type: "lifecycle.error";
};
```

Defined in: [packages/core/src/types/observation.types.ts:51](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/observation.types.ts#L51)

## Type Parameters

| Type Parameter               |
| ---------------------------- |
| `TStepId` _extends_ `string` |

## Properties

### error

```ts
error: unknown;
```

Defined in: [packages/core/src/types/observation.types.ts:59](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/observation.types.ts#L59)

---

### eventType

```ts
eventType: string;
```

Defined in: [packages/core/src/types/observation.types.ts:56](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/observation.types.ts#L56)

---

### from

```ts
from: TStepId;
```

Defined in: [packages/core/src/types/observation.types.ts:54](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/observation.types.ts#L54)

---

### label?

```ts
optional label?: string;
```

Defined in: [packages/core/src/types/observation.types.ts:58](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/observation.types.ts#L58)

---

### phase

```ts
phase: JourneyLifecycleErrorPhase;
```

Defined in: [packages/core/src/types/observation.types.ts:53](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/observation.types.ts#L53)

---

### timestamp

```ts
timestamp: number;
```

Defined in: [packages/core/src/types/observation.types.ts:60](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/observation.types.ts#L60)

---

### to

```ts
to: TStepId | JourneyTerminal;
```

Defined in: [packages/core/src/types/observation.types.ts:55](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/observation.types.ts#L55)

---

### transitionId

```ts
transitionId: string | null;
```

Defined in: [packages/core/src/types/observation.types.ts:57](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/observation.types.ts#L57)

---

### type

```ts
type: "lifecycle.error";
```

Defined in: [packages/core/src/types/observation.types.ts:52](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/observation.types.ts#L52)
