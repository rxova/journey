[**@rxova/journey-core**](../README.md)

---

[@rxova/journey-core](../README.md) / createLinearJourney

# Function: createLinearJourney()

```ts
function createLinearJourney<TContext, TStepId, TStepMeta, THandlers, TPlugins>(
  def,
  options?
): LinearJourneyMachine<TContext, TStepId, TStepMeta, THandlers, TPlugins>;
```

Defined in: [packages/core/src/create-linear-journey.ts:13](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/create-linear-journey.ts#L13)

Creates a linear journey machine from an ordered steps array. Steps are traversed sequentially; `goToNextStep` advances through them in order.

## Type Parameters

| Type Parameter                                                                                    | Default type                 |
| ------------------------------------------------------------------------------------------------- | ---------------------------- |
| `TContext` _extends_ [`JourneyJsonObject`](../type-aliases/JourneyJsonObject.md)                  | -                            |
| `TStepId` _extends_ `string`                                                                      | -                            |
| `TStepMeta`                                                                                       | `unknown`                    |
| `THandlers` _extends_ `Record`\<`string`, `unknown`\>                                             | `Record`\<`never`, `never`\> |
| `TPlugins` _extends_ readonly [`JourneyMachinePlugin`](../type-aliases/JourneyMachinePlugin.md)[] | \[\]                         |

## Parameters

| Parameter  | Type                                                                                                                       |
| ---------- | -------------------------------------------------------------------------------------------------------------------------- |
| `def`      | [`LinearJourneyDefinition`](../type-aliases/LinearJourneyDefinition.md)\<`TContext`, `TStepId`, `TStepMeta`, `THandlers`\> |
| `options?` | [`JourneyMachineOptions`](../type-aliases/JourneyMachineOptions.md)\<`TPlugins`\>                                          |

## Returns

[`LinearJourneyMachine`](../type-aliases/LinearJourneyMachine.md)\<`TContext`, `TStepId`, `TStepMeta`, `THandlers`, `TPlugins`\>
