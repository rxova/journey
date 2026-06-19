[**@rxova/journey-react**](../README.md)

---

[@rxova/journey-react](../README.md) / JourneyRuntimeFactoryFromDefinition

# Type Alias: JourneyRuntimeFactoryFromDefinition\<TDefinition, TPlugins\>

```ts
type JourneyRuntimeFactoryFromDefinition<TDefinition, TPlugins> =
  () => JourneyRuntimeFromDefinition<TDefinition, TPlugins>;
```

Defined in: [react/src/types.ts:222](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/react/src/types.ts#L222)

## Type Parameters

| Type Parameter                                                                    | Default type |
| --------------------------------------------------------------------------------- | ------------ |
| `TDefinition`                                                                     | -            |
| `TPlugins` _extends_ readonly [`JourneyMachinePlugin`](JourneyMachinePlugin.md)[] | \[\]         |

## Returns

[`JourneyRuntimeFromDefinition`](JourneyRuntimeFromDefinition.md)\<`TDefinition`, `TPlugins`\>
