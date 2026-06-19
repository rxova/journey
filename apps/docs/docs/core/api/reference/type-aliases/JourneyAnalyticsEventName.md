[**@rxova/journey-core**](../README.md)

---

[@rxova/journey-core](../README.md) / JourneyAnalyticsEventName

# Type Alias: JourneyAnalyticsEventName

```ts
type JourneyAnalyticsEventName =
  | "journey_started"
  | "step_viewed"
  | "step_exited"
  | "transition_started"
  | "transition_succeeded"
  | "transition_failed"
  | "journey_completed"
  | "journey_terminated"
  | "navigation_previous"
  | "navigation_last_visited"
  | (string & {});
```

Defined in: [packages/core/src/types/analytics.types.ts:8](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/analytics.types.ts#L8)

Standard analytics event names emitted by the analytics plugin.
