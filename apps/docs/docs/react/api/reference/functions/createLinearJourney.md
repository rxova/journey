[**@rxova/journey-react**](../README.md)

---

[@rxova/journey-react](../README.md) / createLinearJourney

# Function: createLinearJourney()

```ts
function createLinearJourney<TContext, TStepId, TStepMeta, THandlers, TPlugins>(
  definition,
  options?
): LinearJourneyRuntime<TContext, TStepId, TStepMeta, TPlugins, THandlers>;
```

Defined in: [react/src/CreateLinearJourney.tsx:13](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/react/src/CreateLinearJourney.tsx#L13)

Creates a linear journey runtime for React. Returns a `LinearJourneyRuntime` with hooks, provider, and the extended `LinearJourneyMachine`.

## Type Parameters

| Type Parameter                                                                                    | Default type                 |
| ------------------------------------------------------------------------------------------------- | ---------------------------- |
| `TContext` _extends_ `JourneyJsonObject`                                                          | -                            |
| `TStepId` _extends_ `string`                                                                      | -                            |
| `TStepMeta`                                                                                       | `unknown`                    |
| `THandlers` _extends_ `Record`\<`string`, `unknown`\>                                             | `Record`\<`never`, `never`\> |
| `TPlugins` _extends_ readonly [`JourneyMachinePlugin`](../type-aliases/JourneyMachinePlugin.md)[] | \[\]                         |

## Parameters

| Parameter    | Type                                                                         |
| ------------ | ---------------------------------------------------------------------------- |
| `definition` | `LinearJourneyDefinition`\<`TContext`, `TStepId`, `TStepMeta`, `THandlers`\> |
| `options?`   | `JourneyOptionsInput`\<`TPlugins`\>                                          |

## Returns

[`LinearJourneyRuntime`](../type-aliases/LinearJourneyRuntime.md)\<`TContext`, `TStepId`, `TStepMeta`, `TPlugins`, `THandlers`\>
