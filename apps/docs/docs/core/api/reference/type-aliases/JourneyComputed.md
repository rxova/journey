[**@rxova/journey-core**](../README.md)

---

[@rxova/journey-core](../README.md) / JourneyComputed

# Type Alias: JourneyComputed\<TStepId\>

```ts
type JourneyComputed<TStepId> =
  | JourneyLinearComputed<TStepId>
  | JourneyGraphComputed<TStepId>
  | JourneyHeadlessComputed<TStepId>;
```

Defined in: [packages/core/src/types/journey.types.ts:205](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/journey.types.ts#L205)

Mode-aware computed state returned by `JourneyMachine.getComputed()`.

## Type Parameters

| Type Parameter               |
| ---------------------------- |
| `TStepId` _extends_ `string` |
