[**@rxova/journey-core**](../README.md)

---

[@rxova/journey-core](../README.md) / JourneyResolvedTransition

# Type Alias: JourneyResolvedTransition\<TContext, TStepId, TEventMap, THandlers\>

```ts
type JourneyResolvedTransition<TContext, TStepId, TEventMap, THandlers> = JourneyTransition<
  TContext,
  TStepId,
  TEventMap,
  THandlers
> & {
  id: string;
  label?: string;
};
```

Defined in: [packages/core/src/types/transitions.types.ts:219](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/transitions.types.ts#L219)

## Type Declaration

| Name     | Type     | Defined in                                                                                                                                                                           |
| -------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`     | `string` | [packages/core/src/types/transitions.types.ts:225](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/transitions.types.ts#L225) |
| `label?` | `string` | [packages/core/src/types/transitions.types.ts:226](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/transitions.types.ts#L226) |

## Type Parameters

| Type Parameter                                                   | Default type                 |
| ---------------------------------------------------------------- | ---------------------------- |
| `TContext` _extends_ [`JourneyJsonObject`](JourneyJsonObject.md) | -                            |
| `TStepId` _extends_ `string`                                     | -                            |
| `TEventMap` _extends_ `Record`\<`string`, `unknown`\>            | `Record`\<`never`, `never`\> |
| `THandlers` _extends_ `Record`\<`string`, `unknown`\>            | `Record`\<`never`, `never`\> |
