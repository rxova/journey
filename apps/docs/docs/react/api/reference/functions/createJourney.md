[**@rxova/journey-react**](../README.md)

---

[@rxova/journey-react](../README.md) / createJourney

# Function: createJourney()

```ts
function createJourney<TDefinition, TPlugins>(
  definition,
  options?
): JourneyRuntimeFromDefinition<TDefinition, TPlugins>;
```

Defined in: [react/src/CreateJourney.tsx:15](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/react/src/CreateJourney.tsx#L15)

Creates a journey machine and returns React hooks/components bound to that machine.
Hooks work without a provider; `JourneyProvider` is only required for `StepRenderer`.

## Type Parameters

| Type Parameter                                                                                    | Default type |
| ------------------------------------------------------------------------------------------------- | ------------ |
| `TDefinition`                                                                                     | -            |
| `TPlugins` _extends_ readonly [`JourneyMachinePlugin`](../type-aliases/JourneyMachinePlugin.md)[] | \[\]         |

## Parameters

| Parameter    | Type                                |
| ------------ | ----------------------------------- |
| `definition` | `TDefinition`                       |
| `options?`   | `JourneyOptionsInput`\<`TPlugins`\> |

## Returns

[`JourneyRuntimeFromDefinition`](../type-aliases/JourneyRuntimeFromDefinition.md)\<`TDefinition`, `TPlugins`\>
