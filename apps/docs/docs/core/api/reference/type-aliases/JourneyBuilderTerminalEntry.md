[**@rxova/journey-core**](../README.md)

---

[@rxova/journey-core](../README.md) / JourneyBuilderTerminalEntry

# Type Alias: JourneyBuilderTerminalEntry\<TContext, TStepId, TEventMap, THandlers, TEventType\>

```ts
type JourneyBuilderTerminalEntry<TContext, TStepId, TEventMap, THandlers, TEventType> =
  | true
  | readonly []
  | readonly JourneyBuilderTerminalCandidate<TContext, TStepId, TEventMap, THandlers, TEventType>[];
```

Defined in: [packages/core/src/journey-builder/types.ts:226](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/journey-builder/types.ts#L226)

## Type Parameters

| Type Parameter                                                         |
| ---------------------------------------------------------------------- |
| `TContext` _extends_ [`JourneyJsonObject`](JourneyJsonObject.md)       |
| `TStepId` _extends_ `string`                                           |
| `TEventMap` _extends_ `Record`\<`string`, `unknown`\>                  |
| `THandlers` _extends_ `Record`\<`string`, `unknown`\>                  |
| `TEventType` _extends_ `JourneyBuilderTerminalEventKey`\<`TEventMap`\> |
