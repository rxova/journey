[**@rxova/journey-core**](../README.md)

---

[@rxova/journey-core](../README.md) / JourneyBuilderCustomEventKey

# Type Alias: JourneyBuilderCustomEventKey\<TEventMap\>

```ts
type JourneyBuilderCustomEventKey<TEventMap> = Exclude<
  keyof TEventMap & string,
  JourneyDefaultEventType
>;
```

Defined in: [packages/core/src/journey-builder/types.ts:23](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/journey-builder/types.ts#L23)

## Type Parameters

| Type Parameter                                        |
| ----------------------------------------------------- |
| `TEventMap` _extends_ `Record`\<`string`, `unknown`\> |
