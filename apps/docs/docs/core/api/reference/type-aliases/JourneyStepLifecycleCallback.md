[**@rxova/journey-core**](../README.md)

---

[@rxova/journey-core](../README.md) / JourneyStepLifecycleCallback

# Type Alias: JourneyStepLifecycleCallback\<TContext, TStepId, TEventMap, THandlers\>

```ts
type JourneyStepLifecycleCallback<TContext, TStepId, TEventMap, THandlers> =
  JourneyBivariantCallback<
    JourneyLifecycleArgs<TContext, TStepId, TEventMap, THandlers>,
    void | Promise<void>
  >;
```

Defined in: [packages/core/src/types/transitions.types.ts:73](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/transitions.types.ts#L73)

## Type Parameters

| Type Parameter                                                   |
| ---------------------------------------------------------------- |
| `TContext` _extends_ [`JourneyJsonObject`](JourneyJsonObject.md) |
| `TStepId` _extends_ `string`                                     |
| `TEventMap` _extends_ `Record`\<`string`, `unknown`\>            |
| `THandlers` _extends_ `Record`\<`string`, `unknown`\>            |
