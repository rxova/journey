[**@rxova/journey-core**](../README.md)

---

[@rxova/journey-core](../README.md) / JourneyEvent

# Type Alias: JourneyEvent\<TStepId, TEventMap\>

```ts
type JourneyEvent<TStepId, TEventMap> = JourneySendEvent<TStepId, TEventMap>;
```

Defined in: [packages/core/src/types/journey.types.ts:117](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/journey.types.ts#L117)

Event union available to transitions and guards for the declared event type set.

## Type Parameters

| Type Parameter                                        | Default type                 |
| ----------------------------------------------------- | ---------------------------- |
| `TStepId` _extends_ `string`                          | -                            |
| `TEventMap` _extends_ `Record`\<`string`, `unknown`\> | `Record`\<`never`, `never`\> |
