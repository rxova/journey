[**@rxova/journey-core**](../README.md)

---

[@rxova/journey-core](../README.md) / JourneyAnalyticsTrackedEvent

# Type Alias: JourneyAnalyticsTrackedEvent\<TContext, TStepId, TStepMeta\>

```ts
type JourneyAnalyticsTrackedEvent<TContext, TStepId, TStepMeta> = {
  machineId?: string;
  name: JourneyAnalyticsEventName;
  payload: JourneyAnalyticsEventPayload<TContext, TStepId, TStepMeta>;
  timestamp: number;
};
```

Defined in: [packages/core/src/types/analytics.types.ts:42](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/analytics.types.ts#L42)

Event envelope passed to analytics trackers.

## Type Parameters

| Type Parameter                                                   |
| ---------------------------------------------------------------- |
| `TContext` _extends_ [`JourneyJsonObject`](JourneyJsonObject.md) |
| `TStepId` _extends_ `string`                                     |
| `TStepMeta`                                                      |

## Properties

### machineId?

```ts
optional machineId?: string;
```

Defined in: [packages/core/src/types/analytics.types.ts:49](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/analytics.types.ts#L49)

---

### name

```ts
name: JourneyAnalyticsEventName;
```

Defined in: [packages/core/src/types/analytics.types.ts:47](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/analytics.types.ts#L47)

---

### payload

```ts
payload: JourneyAnalyticsEventPayload<TContext, TStepId, TStepMeta>;
```

Defined in: [packages/core/src/types/analytics.types.ts:50](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/analytics.types.ts#L50)

---

### timestamp

```ts
timestamp: number;
```

Defined in: [packages/core/src/types/analytics.types.ts:48](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/analytics.types.ts#L48)
