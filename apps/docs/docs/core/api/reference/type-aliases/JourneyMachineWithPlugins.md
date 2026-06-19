[**@rxova/journey-core**](../README.md)

---

[@rxova/journey-core](../README.md) / JourneyMachineWithPlugins

# Type Alias: JourneyMachineWithPlugins\<TContext, TStepId, TEventMap, TStepMeta, THandlers, TPlugins\>

```ts
type JourneyMachineWithPlugins<TContext, TStepId, TEventMap, TStepMeta, THandlers, TPlugins> =
  JourneyMachine<TContext, TStepId, TEventMap, TStepMeta, THandlers> &
    UnionToIntersection<
      JourneyMachinePluginExtensionFor<
        TPlugins[number],
        TContext,
        TStepId,
        TEventMap,
        TStepMeta,
        THandlers
      >
    >;
```

Defined in: [packages/core/src/types/machine.types.ts:351](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/machine.types.ts#L351)

Journey machine API augmented by plugin-provided extensions.

## Type Parameters

| Type Parameter                                                                    | Default type                                                 |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `TContext` _extends_ [`JourneyJsonObject`](JourneyJsonObject.md)                  | -                                                            |
| `TStepId` _extends_ `string`                                                      | -                                                            |
| `TEventMap` _extends_ `Record`\<`string`, `unknown`\>                             | `Record`\<`never`, `never`\>                                 |
| `TStepMeta`                                                                       | `unknown`                                                    |
| `THandlers` _extends_ `Record`\<`string`, `unknown`\>                             | `Record`\<`never`, `never`\>                                 |
| `TPlugins` _extends_ readonly [`JourneyMachinePlugin`](JourneyMachinePlugin.md)[] | readonly [`JourneyMachinePlugin`](JourneyMachinePlugin.md)[] |
