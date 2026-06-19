[**@rxova/journey-react**](../README.md)

---

[@rxova/journey-react](../README.md) / JourneySendResult

# Type Alias: JourneySendResult\<TContext, TStepId\>

```ts
type JourneySendResult<TContext, TStepId> = object;
```

Defined in: [core/src/types/journey.types.ts:337](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/journey.types.ts#L337)

Result returned from send/navigation APIs.

## Type Parameters

| Type Parameter                           |
| ---------------------------------------- |
| `TContext` _extends_ `JourneyJsonObject` |
| `TStepId` _extends_ `string`             |

## Properties

### error?

```ts
optional error?: unknown;
```

Defined in: [core/src/types/journey.types.ts:341](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/journey.types.ts#L341)

---

### label?

```ts
optional label?: string;
```

Defined in: [core/src/types/journey.types.ts:340](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/journey.types.ts#L340)

---

### snapshot

```ts
snapshot: JourneySnapshot<TContext, TStepId>;
```

Defined in: [core/src/types/journey.types.ts:342](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/journey.types.ts#L342)

---

### transitioned

```ts
transitioned: boolean;
```

Defined in: [core/src/types/journey.types.ts:338](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/journey.types.ts#L338)

---

### transitionId?

```ts
optional transitionId?: string;
```

Defined in: [core/src/types/journey.types.ts:339](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/journey.types.ts#L339)
