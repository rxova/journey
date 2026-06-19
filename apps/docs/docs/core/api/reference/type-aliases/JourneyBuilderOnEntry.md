[**@rxova/journey-core**](../README.md)

---

[@rxova/journey-core](../README.md) / JourneyBuilderOnEntry

# Type Alias: JourneyBuilderOnEntry\<TContext, TStepId, TEventMap, THandlers, TEventType\>

```ts
type JourneyBuilderOnEntry<TContext, TStepId, TEventMap, THandlers, TEventType> =
  | readonly JourneyBuiltTransitionCandidate<TContext, TStepId, TEventMap, THandlers>[]
  | ((
      helpers
    ) => readonly JourneyBuiltTransitionCandidate<
      TContext,
      TStepId,
      TEventMap,
      THandlers,
      TEventType
    >[]);
```

Defined in: [packages/core/src/journey-builder/types.ts:191](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/journey-builder/types.ts#L191)

## Type Parameters

| Type Parameter                                                     |
| ------------------------------------------------------------------ |
| `TContext` _extends_ [`JourneyJsonObject`](JourneyJsonObject.md)   |
| `TStepId` _extends_ `string`                                       |
| `TEventMap` _extends_ `Record`\<`string`, `unknown`\>              |
| `THandlers` _extends_ `Record`\<`string`, `unknown`\>              |
| `TEventType` _extends_ `JourneyBuilderStepEventKey`\<`TEventMap`\> |
