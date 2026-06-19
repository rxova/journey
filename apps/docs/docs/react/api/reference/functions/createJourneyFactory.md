[**@rxova/journey-react**](../README.md)

---

[@rxova/journey-react](../README.md) / createJourneyFactory

# Function: createJourneyFactory()

```ts
function createJourneyFactory<TDefinition, TPlugins>(
  definition,
  options?
): JourneyRuntimeFactoryFromDefinition<TDefinition, TPlugins>;
```

Defined in: [react/src/CreateJourneyFactory.tsx:16](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/react/src/CreateJourneyFactory.tsx#L16)

Creates a typed factory for producing fresh React-bound journey runtimes.
Use this when a component or route boundary needs independent instances
from the same definition/options pair.

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

[`JourneyRuntimeFactoryFromDefinition`](../type-aliases/JourneyRuntimeFactoryFromDefinition.md)\<`TDefinition`, `TPlugins`\>
