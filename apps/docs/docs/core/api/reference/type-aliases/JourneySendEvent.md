[**@rxova/journey-core**](../README.md)

---

[@rxova/journey-core](../README.md) / JourneySendEvent

# Type Alias: JourneySendEvent\<TStepId, TEventMap\>

```ts
type JourneySendEvent<TStepId, TEventMap> =
  | JourneyBuiltInSendEvent<TStepId, TEventMap>
  | JourneyCustomSendEvent<TEventMap>;
```

Defined in: [packages/core/src/types/journey.types.ts:111](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/journey.types.ts#L111)

Event union accepted by `JourneyMachine.send`.

## Type Parameters

| Type Parameter                                        | Default type                 |
| ----------------------------------------------------- | ---------------------------- |
| `TStepId` _extends_ `string`                          | -                            |
| `TEventMap` _extends_ `Record`\<`string`, `unknown`\> | `Record`\<`never`, `never`\> |
