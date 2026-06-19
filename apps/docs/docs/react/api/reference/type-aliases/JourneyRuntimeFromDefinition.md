[**@rxova/journey-react**](../README.md)

---

[@rxova/journey-react](../README.md) / JourneyRuntimeFromDefinition

# Type Alias: JourneyRuntimeFromDefinition\<TDefinition, TPlugins\>

```ts
type JourneyRuntimeFromDefinition<TDefinition, TPlugins> =
  TDefinition extends JourneyDefinition<
    infer TContext,
    infer TStepId,
    infer TEventMap,
    infer TStepMeta,
    infer THandlers
  >
    ? JourneyRuntimeWithStepApi<
        Extract<TContext, JourneyJsonObject>,
        Extract<TStepId, string>,
        Extract<TEventMap, Record<string, unknown>>,
        TStepMeta,
        TPlugins,
        Extract<THandlers, Record<string, unknown>>,
        JourneyStepHandledCustomEventMapFromDefinition<
          TDefinition,
          Extract<TStepId, string>,
          Extract<TEventMap, Record<string, unknown>>
        >,
        JourneyGlobalHandledCustomEventTypeFromDefinition<
          TDefinition,
          Extract<TStepId, string>,
          Extract<TEventMap, Record<string, unknown>>
        >
      >
    : never;
```

Defined in: [react/src/types.ts:191](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/react/src/types.ts#L191)

## Type Parameters

| Type Parameter                                                                    | Default type |
| --------------------------------------------------------------------------------- | ------------ |
| `TDefinition`                                                                     | -            |
| `TPlugins` _extends_ readonly [`JourneyMachinePlugin`](JourneyMachinePlugin.md)[] | \[\]         |
