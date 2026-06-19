[**@rxova/journey-core**](../README.md)

---

[@rxova/journey-core](../README.md) / JourneyEqualityFn

# Type Alias: JourneyEqualityFn\<TValue\>

```ts
type JourneyEqualityFn<TValue> = (previous, next) => boolean;
```

Defined in: [packages/core/src/types/journey.types.ts:218](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/journey.types.ts#L218)

Equality function used to compare selected values between snapshot updates.

## Type Parameters

| Type Parameter |
| -------------- |
| `TValue`       |

## Parameters

| Parameter  | Type     |
| ---------- | -------- |
| `previous` | `TValue` |
| `next`     | `TValue` |

## Returns

`boolean`
