[**@rxova/journey-core**](../README.md)

---

[@rxova/journey-core](../README.md) / getJourneyMachineDevtoolsRegistry

# Function: getJourneyMachineDevtoolsRegistry()

```ts
function getJourneyMachineDevtoolsRegistry<TContext, TStepId, TEventMap, TStepMeta, THandlers>(
  machine
): JourneyMachineDevtoolsRegistry<TContext, TStepId, TEventMap, TStepMeta, THandlers> | undefined;
```

Defined in: [packages/core/src/journey-machine/devtools-registry.ts:52](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/journey-machine/devtools-registry.ts#L52)

Returns the internal devtools registry attached to a journey machine, when present.

## Type Parameters

| Type Parameter                                                                   | Default type                 |
| -------------------------------------------------------------------------------- | ---------------------------- |
| `TContext` _extends_ [`JourneyJsonObject`](../type-aliases/JourneyJsonObject.md) | -                            |
| `TStepId` _extends_ `string`                                                     | -                            |
| `TEventMap` _extends_ `Record`\<`string`, `unknown`\>                            | `Record`\<`never`, `never`\> |
| `TStepMeta`                                                                      | `unknown`                    |
| `THandlers` _extends_ `Record`\<`string`, `unknown`\>                            | `Record`\<`never`, `never`\> |

## Parameters

| Parameter | Type                                                                                                                  |
| --------- | --------------------------------------------------------------------------------------------------------------------- |
| `machine` | [`JourneyMachine`](../type-aliases/JourneyMachine.md)\<`TContext`, `TStepId`, `TEventMap`, `TStepMeta`, `THandlers`\> |

## Returns

\| `JourneyMachineDevtoolsRegistry`\<`TContext`, `TStepId`, `TEventMap`, `TStepMeta`, `THandlers`\>
\| `undefined`
