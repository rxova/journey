[**@rxova/journey-core**](../README.md)

---

[@rxova/journey-core](../README.md) / JourneyAnalyticsPluginOptions

# Type Alias: JourneyAnalyticsPluginOptions\<TContext, TStepId, TEventMap, TStepMeta\>

```ts
type JourneyAnalyticsPluginOptions<TContext, TStepId, TEventMap, TStepMeta> = {
  includeStepMeta?: boolean;
  machineId?: string;
  onError?: (error, event?) => void;
  track: (event) => void;
};
```

Defined in: [packages/core/src/types/analytics.types.ts:54](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/analytics.types.ts#L54)

Options for the analytics plugin.

## Type Parameters

| Type Parameter                                                   | Default type                 |
| ---------------------------------------------------------------- | ---------------------------- |
| `TContext` _extends_ [`JourneyJsonObject`](JourneyJsonObject.md) | -                            |
| `TStepId` _extends_ `string`                                     | -                            |
| `TEventMap` _extends_ `Record`\<`string`, `unknown`\>            | `Record`\<`never`, `never`\> |
| `TStepMeta`                                                      | `unknown`                    |

## Properties

### includeStepMeta?

```ts
optional includeStepMeta?: boolean;
```

Defined in: [packages/core/src/types/analytics.types.ts:62](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/analytics.types.ts#L62)

---

### machineId?

```ts
optional machineId?: string;
```

Defined in: [packages/core/src/types/analytics.types.ts:61](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/analytics.types.ts#L61)

---

### onError?

```ts
optional onError?: (error, event?) => void;
```

Defined in: [packages/core/src/types/analytics.types.ts:63](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/analytics.types.ts#L63)

#### Parameters

| Parameter | Type                                                                                                                                                                                            |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `error`   | `unknown`                                                                                                                                                                                       |
| `event?`  | \| [`JourneyObservationEvent`](JourneyObservationEvent.md)\<`TStepId`, `TEventMap`\> \| [`JourneyAnalyticsTrackedEvent`](JourneyAnalyticsTrackedEvent.md)\<`TContext`, `TStepId`, `TStepMeta`\> |

#### Returns

`void`

---

### track

```ts
track: (event) => void;
```

Defined in: [packages/core/src/types/analytics.types.ts:60](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/analytics.types.ts#L60)

#### Parameters

| Parameter | Type                                                                                                    |
| --------- | ------------------------------------------------------------------------------------------------------- |
| `event`   | [`JourneyAnalyticsTrackedEvent`](JourneyAnalyticsTrackedEvent.md)\<`TContext`, `TStepId`, `TStepMeta`\> |

#### Returns

`void`
