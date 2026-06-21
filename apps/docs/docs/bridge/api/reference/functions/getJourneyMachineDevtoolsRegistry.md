[**@rxova/journey-devtools-bridge**](../README.md)

---

[@rxova/journey-devtools-bridge](../README.md) / getJourneyMachineDevtoolsRegistry

# Function: getJourneyMachineDevtoolsRegistry()

```ts
function getJourneyMachineDevtoolsRegistry<TContext, TStepId, TEventMap, TStepMeta, THandlers>(
  machine
): JourneyMachineDevtoolsRegistry<TContext, TStepId, TEventMap, TStepMeta, THandlers> | undefined;
```

Defined in: [core/src/journey-machine/devtools-registry.ts:52](https://github.com/rxova/journey/blob/4c7c1e18426b9821f139ba0a14313fb42df5782b/packages/core/src/journey-machine/devtools-registry.ts#L52)

Returns the internal devtools registry attached to a journey machine, when present.

## Type Parameters

| Type Parameter                                        | Default type                 |
| ----------------------------------------------------- | ---------------------------- |
| `TContext` _extends_ `JourneyJsonObject`              | -                            |
| `TStepId` _extends_ `string`                          | -                            |
| `TEventMap` _extends_ `Record`\<`string`, `unknown`\> | `Record`\<`never`, `never`\> |
| `TStepMeta`                                           | `unknown`                    |
| `THandlers` _extends_ `Record`\<`string`, `unknown`\> | `Record`\<`never`, `never`\> |

## Parameters

| Parameter | Type                                                                             |
| --------- | -------------------------------------------------------------------------------- |
| `machine` | `JourneyMachine`\<`TContext`, `TStepId`, `TEventMap`, `TStepMeta`, `THandlers`\> |

## Returns

\| `JourneyMachineDevtoolsRegistry`\<`TContext`, `TStepId`, `TEventMap`, `TStepMeta`, `THandlers`\>
\| `undefined`
