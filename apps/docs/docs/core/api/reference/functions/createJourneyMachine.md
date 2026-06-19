[**@rxova/journey-core**](../README.md)

---

[@rxova/journey-core](../README.md) / createJourneyMachine

# ~~Function: createJourneyMachine()~~

```ts
function createJourneyMachine<TContext, TStepId, TEventMap, TStepMeta, THandlers, TPlugins>(
  journey,
  options?
): JourneyMachineWithPlugins<TContext, TStepId, TEventMap, TStepMeta, THandlers, TPlugins>;
```

Defined in: [packages/core/src/journey-machine/index.ts:41](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/journey-machine/index.ts#L41)

Creates a journey machine from a definition and optional runtime/plugin options.

## Type Parameters

| Type Parameter                                                                                    | Default type                 |
| ------------------------------------------------------------------------------------------------- | ---------------------------- |
| `TContext` _extends_ [`JourneyJsonObject`](../type-aliases/JourneyJsonObject.md)                  | -                            |
| `TStepId` _extends_ `string`                                                                      | -                            |
| `TEventMap` _extends_ `Record`\<`string`, `unknown`\>                                             | `Record`\<`never`, `never`\> |
| `TStepMeta`                                                                                       | `unknown`                    |
| `THandlers` _extends_ `Record`\<`string`, `unknown`\>                                             | `Record`\<`never`, `never`\> |
| `TPlugins` _extends_ readonly [`JourneyMachinePlugin`](../type-aliases/JourneyMachinePlugin.md)[] | \[\]                         |

## Parameters

| Parameter  | Type                                                                                                                        |
| ---------- | --------------------------------------------------------------------------------------------------------------------------- |
| `journey`  | [`JourneyDefinition`](../type-aliases/JourneyDefinition.md)\<`TContext`, `TStepId`, `TEventMap`, `TStepMeta`, `THandlers`\> |
| `options?` | [`JourneyMachineOptions`](../type-aliases/JourneyMachineOptions.md)\<`TPlugins`\>                                           |

## Returns

[`JourneyMachineWithPlugins`](../type-aliases/JourneyMachineWithPlugins.md)\<`TContext`, `TStepId`, `TEventMap`, `TStepMeta`, `THandlers`, `TPlugins`\>
