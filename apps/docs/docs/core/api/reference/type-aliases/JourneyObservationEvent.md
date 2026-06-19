[**@rxova/journey-core**](../README.md)

---

[@rxova/journey-core](../README.md) / JourneyObservationEvent

# Type Alias: JourneyObservationEvent\<TStepId, TEventMap\>

```ts
type JourneyObservationEvent<TStepId, TEventMap> =
  | JourneyStartObservationEvent<TStepId>
  | JourneyResetObservationEvent<TStepId>
  | JourneyTransitionStartObservationEvent<TStepId, TEventMap>
  | JourneyTransitionSuccessObservationEvent<TStepId>
  | JourneyTransitionErrorObservationEvent<TStepId>
  | JourneyLifecycleErrorObservationEvent<TStepId>
  | JourneyStepExitObservationEvent<TStepId>
  | JourneyStepEnterObservationEvent<TStepId>
  | JourneyCompleteObservationEvent<TStepId>
  | JourneyTerminateObservationEvent<TStepId>
  | JourneyPreviousNavigationObservationEvent<TStepId>
  | JourneyLastVisitedNavigationObservationEvent<TStepId>;
```

Defined in: [packages/core/src/types/observation.types.ts:104](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/observation.types.ts#L104)

Observation events emitted by the machine lifecycle/event stream.

## Type Parameters

| Type Parameter                                        | Default type                 |
| ----------------------------------------------------- | ---------------------------- |
| `TStepId` _extends_ `string`                          | -                            |
| `TEventMap` _extends_ `Record`\<`string`, `unknown`\> | `Record`\<`never`, `never`\> |
