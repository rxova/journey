[**@rxova/journey-core**](../README.md)

---

[@rxova/journey-core](../README.md) / createGraphJourneyBuilder

# Function: createGraphJourneyBuilder()

```ts
function createGraphJourneyBuilder<
  TContext,
  TStepId,
  TEventMap,
  TStepMeta,
  THandlers
>(): JourneyBuilder<TContext, TStepId, TEventMap, TStepMeta, THandlers>;
```

Defined in: [packages/core/src/journey-builder/index.ts:158](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/journey-builder/index.ts#L158)

Creates a typed builder for authoring journey definitions with `createStep`, `to`, and `build` helpers.

## Type Parameters

| Type Parameter                                                                   | Default type                 |
| -------------------------------------------------------------------------------- | ---------------------------- |
| `TContext` _extends_ [`JourneyJsonObject`](../type-aliases/JourneyJsonObject.md) | -                            |
| `TStepId` _extends_ `string`                                                     | -                            |
| `TEventMap` _extends_ `Record`\<`string`, `unknown`\>                            | `Record`\<`never`, `never`\> |
| `TStepMeta`                                                                      | `unknown`                    |
| `THandlers` _extends_ `Record`\<`string`, `unknown`\>                            | `Record`\<`never`, `never`\> |

## Returns

[`JourneyBuilder`](../type-aliases/JourneyBuilder.md)\<`TContext`, `TStepId`, `TEventMap`, `TStepMeta`, `THandlers`\>
