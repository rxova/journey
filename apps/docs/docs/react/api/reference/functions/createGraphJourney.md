[**@rxova/journey-react**](../README.md)

---

[@rxova/journey-react](../README.md) / createGraphJourney

# Function: createGraphJourney()

```ts
function createGraphJourney<TContext, TStepId, TEventMap, TStepMeta, THandlers, TPlugins>(
  definition,
  options?
): JourneyRuntime<TContext, TStepId, TEventMap, TStepMeta, TPlugins, THandlers>;
```

Defined in: [react/src/CreateGraphJourney.tsx:13](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/react/src/CreateGraphJourney.tsx#L13)

Creates a graph journey runtime for React from a `GraphJourneyDefinition` or builder output.

## Type Parameters

| Type Parameter                                                                                    | Default type                 |
| ------------------------------------------------------------------------------------------------- | ---------------------------- |
| `TContext` _extends_ `JourneyJsonObject`                                                          | -                            |
| `TStepId` _extends_ `string`                                                                      | -                            |
| `TEventMap` _extends_ `Record`\<`string`, `unknown`\>                                             | `Record`\<`never`, `never`\> |
| `TStepMeta`                                                                                       | `unknown`                    |
| `THandlers` _extends_ `Record`\<`string`, `unknown`\>                                             | `Record`\<`never`, `never`\> |
| `TPlugins` _extends_ readonly [`JourneyMachinePlugin`](../type-aliases/JourneyMachinePlugin.md)[] | \[\]                         |

## Parameters

| Parameter    | Type                                                                                     |
| ------------ | ---------------------------------------------------------------------------------------- |
| `definition` | `GraphJourneyDefinition`\<`TContext`, `TStepId`, `TEventMap`, `TStepMeta`, `THandlers`\> |
| `options?`   | `JourneyOptionsInput`\<`TPlugins`\>                                                      |

## Returns

[`JourneyRuntime`](../type-aliases/JourneyRuntime.md)\<`TContext`, `TStepId`, `TEventMap`, `TStepMeta`, `TPlugins`, `THandlers`\>
