[**@rxova/journey-core**](../README.md)

---

[@rxova/journey-core](../README.md) / JourneyJsonValue

# Type Alias: JourneyJsonValue

```ts
type JourneyJsonValue =
  | JourneyJsonPrimitive
  | {
      [key: string]: JourneyJsonValue;
    }
  | JourneyJsonValue[];
```

Defined in: [packages/core/src/types/journey.types.ts:31](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/journey.types.ts#L31)

JSON-compatible value accepted inside runtime context.
