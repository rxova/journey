[**@rxova/journey-core**](../README.md)

---

[@rxova/journey-core](../README.md) / JourneyFullEventType

# Type Alias: JourneyFullEventType\<TEventMap\>

```ts
type JourneyFullEventType<TEventMap> = (keyof TEventMap & string) | JourneyDefaultEventType;
```

Defined in: [packages/core/src/types/journey.types.ts:40](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/journey.types.ts#L40)

Derives the full event type union from a user-supplied event map.

## Type Parameters

| Type Parameter                                        |
| ----------------------------------------------------- |
| `TEventMap` _extends_ `Record`\<`string`, `unknown`\> |
