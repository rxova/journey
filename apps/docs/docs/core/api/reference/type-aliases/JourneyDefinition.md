[**@rxova/journey-core**](../README.md)

---

[@rxova/journey-core](../README.md) / JourneyDefinition

# Type Alias: JourneyDefinition\<TContext, TStepId, TEventMap, TStepMeta, THandlers\>

```ts
type JourneyDefinition<TContext, TStepId, TEventMap, TStepMeta, THandlers> = Omit<
  JourneyDefinitionBase<TContext, TStepId, TStepMeta, THandlers>,
  "steps"
> & {
  steps: Record<TStepId, JourneyStepDefinition<TContext, TStepId, TEventMap, TStepMeta, THandlers>>;
  transitions?: JourneyTransitionsDefinition<TContext, TStepId, TEventMap, THandlers>;
};
```

Defined in: [packages/core/src/types/journey.types.ts:290](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/journey.types.ts#L290)

Full machine definition used to create a journey machine instance.

## Type Declaration

| Name           | Type                                                                                                                                       | Defined in                                                                                                                                                                   |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `steps`        | `Record`\<`TStepId`, [`JourneyStepDefinition`](JourneyStepDefinition.md)\<`TContext`, `TStepId`, `TEventMap`, `TStepMeta`, `THandlers`\>\> | [packages/core/src/types/journey.types.ts:297](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/journey.types.ts#L297) |
| `transitions?` | `JourneyTransitionsDefinition`\<`TContext`, `TStepId`, `TEventMap`, `THandlers`\>                                                          | [packages/core/src/types/journey.types.ts:298](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/journey.types.ts#L298) |

## Type Parameters

| Type Parameter                                                   | Default type                 |
| ---------------------------------------------------------------- | ---------------------------- |
| `TContext` _extends_ [`JourneyJsonObject`](JourneyJsonObject.md) | -                            |
| `TStepId` _extends_ `string`                                     | -                            |
| `TEventMap` _extends_ `Record`\<`string`, `unknown`\>            | `Record`\<`never`, `never`\> |
| `TStepMeta`                                                      | `unknown`                    |
| `THandlers` _extends_ `Record`\<`string`, `unknown`\>            | `Record`\<`never`, `never`\> |
