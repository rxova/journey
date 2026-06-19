[**@rxova/journey-core**](../README.md)

---

[@rxova/journey-core](../README.md) / JourneyResolvedDefinition

# Type Alias: JourneyResolvedDefinition\<TContext, TStepId, TEventMap, TStepMeta, THandlers\>

```ts
type JourneyResolvedDefinition<TContext, TStepId, TEventMap, TStepMeta, THandlers> = Required<
  Pick<JourneyDefinitionBase<TContext, TStepId, TStepMeta, THandlers>, "initial">
> &
  Omit<JourneyDefinition<TContext, TStepId, TEventMap, TStepMeta, THandlers>, "transitions"> & {
    transitions: readonly JourneyResolvedTransition<TContext, TStepId, TEventMap, THandlers>[];
  };
```

Defined in: [packages/core/src/types/journey.types.ts:301](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/journey.types.ts#L301)

## Type Declaration

| Name          | Type                                                                                                                      | Defined in                                                                                                                                                                   |
| ------------- | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `transitions` | readonly [`JourneyResolvedTransition`](JourneyResolvedTransition.md)\<`TContext`, `TStepId`, `TEventMap`, `THandlers`\>[] | [packages/core/src/types/journey.types.ts:309](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/journey.types.ts#L309) |

## Type Parameters

| Type Parameter                                                   | Default type                 |
| ---------------------------------------------------------------- | ---------------------------- |
| `TContext` _extends_ [`JourneyJsonObject`](JourneyJsonObject.md) | -                            |
| `TStepId` _extends_ `string`                                     | -                            |
| `TEventMap` _extends_ `Record`\<`string`, `unknown`\>            | `Record`\<`never`, `never`\> |
| `TStepMeta`                                                      | `unknown`                    |
| `THandlers` _extends_ `Record`\<`string`, `unknown`\>            | `Record`\<`never`, `never`\> |
