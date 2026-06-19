[**@rxova/journey-core**](../README.md)

---

[@rxova/journey-core](../README.md) / JourneyAnalyticsEventPayload

# Type Alias: JourneyAnalyticsEventPayload\<TContext, TStepId, TStepMeta\>

```ts
type JourneyAnalyticsEventPayload<TContext, TStepId, TStepMeta> = Record<string, unknown> & {
  context?: TContext;
  durationMs?: number;
  dwellMs?: number;
  eventType?: string;
  from?: TStepId;
  fromStepMeta?: TStepMeta;
  label?: JourneyTransitionSuccessObservationEvent<TStepId>["label"];
  stepId?: TStepId;
  stepMeta?: TStepMeta;
  to?: TStepId | JourneyTerminal;
  toStepMeta?: TStepMeta;
  transitionId?: JourneyTransitionSuccessObservationEvent<TStepId>["transitionId"];
};
```

Defined in: [packages/core/src/types/analytics.types.ts:22](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/analytics.types.ts#L22)

Analytics payload emitted by the analytics plugin.

## Type Declaration

| Name            | Type                                                                        | Defined in                                                                                                                                                                     |
| --------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `context?`      | `TContext`                                                                  | [packages/core/src/types/analytics.types.ts:27](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/analytics.types.ts#L27) |
| `durationMs?`   | `number`                                                                    | [packages/core/src/types/analytics.types.ts:34](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/analytics.types.ts#L34) |
| `dwellMs?`      | `number`                                                                    | [packages/core/src/types/analytics.types.ts:35](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/analytics.types.ts#L35) |
| `eventType?`    | `string`                                                                    | [packages/core/src/types/analytics.types.ts:36](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/analytics.types.ts#L36) |
| `from?`         | `TStepId`                                                                   | [packages/core/src/types/analytics.types.ts:30](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/analytics.types.ts#L30) |
| `fromStepMeta?` | `TStepMeta`                                                                 | [packages/core/src/types/analytics.types.ts:32](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/analytics.types.ts#L32) |
| `label?`        | `JourneyTransitionSuccessObservationEvent`\<`TStepId`\>\[`"label"`\]        | [packages/core/src/types/analytics.types.ts:38](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/analytics.types.ts#L38) |
| `stepId?`       | `TStepId`                                                                   | [packages/core/src/types/analytics.types.ts:28](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/analytics.types.ts#L28) |
| `stepMeta?`     | `TStepMeta`                                                                 | [packages/core/src/types/analytics.types.ts:29](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/analytics.types.ts#L29) |
| `to?`           | `TStepId` \| `JourneyTerminal`                                              | [packages/core/src/types/analytics.types.ts:31](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/analytics.types.ts#L31) |
| `toStepMeta?`   | `TStepMeta`                                                                 | [packages/core/src/types/analytics.types.ts:33](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/analytics.types.ts#L33) |
| `transitionId?` | `JourneyTransitionSuccessObservationEvent`\<`TStepId`\>\[`"transitionId"`\] | [packages/core/src/types/analytics.types.ts:37](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/analytics.types.ts#L37) |

## Type Parameters

| Type Parameter                                                   |
| ---------------------------------------------------------------- |
| `TContext` _extends_ [`JourneyJsonObject`](JourneyJsonObject.md) |
| `TStepId` _extends_ `string`                                     |
| `TStepMeta`                                                      |
