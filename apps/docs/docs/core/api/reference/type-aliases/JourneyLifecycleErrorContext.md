[**@rxova/journey-core**](../README.md)

---

[@rxova/journey-core](../README.md) / JourneyLifecycleErrorContext

# Type Alias: JourneyLifecycleErrorContext\<TStepId\>

```ts
type JourneyLifecycleErrorContext<TStepId> = {
  eventType: string;
  from: TStepId;
  label?: string;
  phase: JourneyLifecycleErrorPhase;
  to: TStepId | JourneyTerminal;
  transitionId: string | null;
};
```

Defined in: [packages/core/src/types/machine.types.ts:33](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/machine.types.ts#L33)

## Type Parameters

| Type Parameter               |
| ---------------------------- |
| `TStepId` _extends_ `string` |

## Properties

### eventType

```ts
eventType: string;
```

Defined in: [packages/core/src/types/machine.types.ts:37](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/machine.types.ts#L37)

---

### from

```ts
from: TStepId;
```

Defined in: [packages/core/src/types/machine.types.ts:35](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/machine.types.ts#L35)

---

### label?

```ts
optional label?: string;
```

Defined in: [packages/core/src/types/machine.types.ts:39](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/machine.types.ts#L39)

---

### phase

```ts
phase: JourneyLifecycleErrorPhase;
```

Defined in: [packages/core/src/types/machine.types.ts:34](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/machine.types.ts#L34)

---

### to

```ts
to: TStepId | JourneyTerminal;
```

Defined in: [packages/core/src/types/machine.types.ts:36](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/machine.types.ts#L36)

---

### transitionId

```ts
transitionId: string | null;
```

Defined in: [packages/core/src/types/machine.types.ts:38](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/machine.types.ts#L38)
