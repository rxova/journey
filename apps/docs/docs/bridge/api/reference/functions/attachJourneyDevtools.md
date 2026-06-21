[**@rxova/journey-devtools-bridge**](../README.md)

---

[@rxova/journey-devtools-bridge](../README.md) / attachJourneyDevtools

# Function: attachJourneyDevtools()

```ts
function attachJourneyDevtools<TContext, TStepId, TEventMap, TStepMeta, THandlers>(
  machine,
  options?
): () => void;
```

Defined in: [devtools-bridge/src/bridge.ts:552](https://github.com/rxova/journey/blob/4c7c1e18426b9821f139ba0a14313fb42df5782b/packages/devtools-bridge/src/bridge.ts#L552)

Attaches the browser devtools bridge to a journey machine and returns a detach cleanup.

## Type Parameters

| Type Parameter                                        | Default type                 |
| ----------------------------------------------------- | ---------------------------- |
| `TContext` _extends_ `JourneyJsonObject`              | -                            |
| `TStepId` _extends_ `string`                          | -                            |
| `TEventMap` _extends_ `Record`\<`string`, `unknown`\> | `Record`\<`never`, `never`\> |
| `TStepMeta`                                           | `unknown`                    |
| `THandlers` _extends_ `Record`\<`string`, `unknown`\> | `Record`\<`never`, `never`\> |

## Parameters

| Parameter | Type                                                                              |
| --------- | --------------------------------------------------------------------------------- |
| `machine` | `JourneyMachine`\<`TContext`, `TStepId`, `TEventMap`, `TStepMeta`, `THandlers`\>  |
| `options` | [`JourneyDevtoolsBridgeOptions`](../type-aliases/JourneyDevtoolsBridgeOptions.md) |

## Returns

() => `void`
