[**@rxova/journey-core**](../README.md)

---

[@rxova/journey-core](../README.md) / JourneyPayloadFor

# Type Alias: JourneyPayloadFor\<TEventMap, TEvent\>

```ts
type JourneyPayloadFor<TEventMap, TEvent> = TEvent extends keyof TEventMap
  ? TEventMap[TEvent]
  : unknown;
```

Defined in: [packages/core/src/types/journey.types.ts:75](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/journey.types.ts#L75)

Resolves payload type for a specific event type from the provided event map.

## Type Parameters

| Type Parameter                                        |
| ----------------------------------------------------- |
| `TEventMap` _extends_ `Record`\<`string`, `unknown`\> |
| `TEvent` _extends_ `string`                           |
