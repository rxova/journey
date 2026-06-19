[**@rxova/journey-core**](../README.md)

---

[@rxova/journey-core](../README.md) / createHeadlessJourney

# Function: createHeadlessJourney()

```ts
function createHeadlessJourney<TContext, TStepId, TStepMeta, THandlers, TPlugins>(
  def,
  options?
): JourneyMachineWithPlugins<
  TContext,
  TStepId,
  Record<never, never>,
  TStepMeta,
  THandlers,
  TPlugins
>;
```

Defined in: [packages/core/src/create-headless-journey.ts:11](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/create-headless-journey.ts#L11)

Creates a headless journey machine with no predefined transition graph. Navigation is entirely caller-driven via `goToStepById`.

## Type Parameters

| Type Parameter                                                                                    | Default type                 |
| ------------------------------------------------------------------------------------------------- | ---------------------------- |
| `TContext` _extends_ [`JourneyJsonObject`](../type-aliases/JourneyJsonObject.md)                  | -                            |
| `TStepId` _extends_ `string`                                                                      | -                            |
| `TStepMeta`                                                                                       | `unknown`                    |
| `THandlers` _extends_ `Record`\<`string`, `unknown`\>                                             | `Record`\<`never`, `never`\> |
| `TPlugins` _extends_ readonly [`JourneyMachinePlugin`](../type-aliases/JourneyMachinePlugin.md)[] | \[\]                         |

## Parameters

| Parameter  | Type                                                                                                                           |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `def`      | [`HeadlessJourneyDefinition`](../type-aliases/HeadlessJourneyDefinition.md)\<`TContext`, `TStepId`, `TStepMeta`, `THandlers`\> |
| `options?` | [`JourneyMachineOptions`](../type-aliases/JourneyMachineOptions.md)\<`TPlugins`\>                                              |

## Returns

[`JourneyMachineWithPlugins`](../type-aliases/JourneyMachineWithPlugins.md)\<`TContext`, `TStepId`, `Record`\<`never`, `never`\>, `TStepMeta`, `THandlers`, `TPlugins`\>
