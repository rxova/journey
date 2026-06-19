[**@rxova/journey-core**](../README.md)

---

[@rxova/journey-core](../README.md) / createGraphJourney

# Function: createGraphJourney()

Creates a graph journey machine from a builder definition or a plain `GraphJourneyDefinition` with an object-keyed `transitions` map.

## Call Signature

```ts
function createGraphJourney<TDefinition, TPlugins>(
  def,
  options?
): TDefinition extends JourneyDefinition<TC, TS, TE, TM, TH>
  ? JourneyMachineWithPlugins<TC, TS, TE, TM, TH, TPlugins>
  : never;
```

Defined in: [packages/core/src/create-graph-journey.ts:17](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/create-graph-journey.ts#L17)

Creates a graph journey machine from a builder definition or a plain
definition object with an object-style `transitions` map.
The builder overload accepts `JourneyBuilderDefinition` output directly.

### Type Parameters

| Type Parameter                                                                                    | Default type |
| ------------------------------------------------------------------------------------------------- | ------------ |
| `TDefinition`                                                                                     | -            |
| `TPlugins` _extends_ readonly [`JourneyMachinePlugin`](../type-aliases/JourneyMachinePlugin.md)[] | \[\]         |

### Parameters

| Parameter  | Type                                                                              |
| ---------- | --------------------------------------------------------------------------------- |
| `def`      | `TDefinition`                                                                     |
| `options?` | [`JourneyMachineOptions`](../type-aliases/JourneyMachineOptions.md)\<`TPlugins`\> |

### Returns

`TDefinition` _extends_ [`JourneyDefinition`](../type-aliases/JourneyDefinition.md)\<`TC`, `TS`, `TE`, `TM`, `TH`\> ? [`JourneyMachineWithPlugins`](../type-aliases/JourneyMachineWithPlugins.md)\<`TC`, `TS`, `TE`, `TM`, `TH`, `TPlugins`\> : `never`

## Call Signature

```ts
function createGraphJourney<TContext, TStepId, TEventMap, TStepMeta, THandlers, TPlugins>(
  def,
  options?
): JourneyMachineWithPlugins<TContext, TStepId, TEventMap, TStepMeta, THandlers, TPlugins>;
```

Defined in: [packages/core/src/create-graph-journey.ts:26](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/create-graph-journey.ts#L26)

Creates a graph journey machine from a builder definition or a plain
definition object with an object-style `transitions` map.
The builder overload accepts `JourneyBuilderDefinition` output directly.

### Type Parameters

| Type Parameter                                                                                    | Default type                 |
| ------------------------------------------------------------------------------------------------- | ---------------------------- |
| `TContext` _extends_ [`JourneyJsonObject`](../type-aliases/JourneyJsonObject.md)                  | -                            |
| `TStepId` _extends_ `string`                                                                      | -                            |
| `TEventMap` _extends_ `Record`\<`string`, `unknown`\>                                             | `Record`\<`never`, `never`\> |
| `TStepMeta`                                                                                       | `unknown`                    |
| `THandlers` _extends_ `Record`\<`string`, `unknown`\>                                             | `Record`\<`never`, `never`\> |
| `TPlugins` _extends_ readonly [`JourneyMachinePlugin`](../type-aliases/JourneyMachinePlugin.md)[] | \[\]                         |

### Parameters

| Parameter  | Type                                                                                                                                  |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `def`      | [`GraphJourneyDefinition`](../type-aliases/GraphJourneyDefinition.md)\<`TContext`, `TStepId`, `TEventMap`, `TStepMeta`, `THandlers`\> |
| `options?` | [`JourneyMachineOptions`](../type-aliases/JourneyMachineOptions.md)\<`TPlugins`\>                                                     |

### Returns

[`JourneyMachineWithPlugins`](../type-aliases/JourneyMachineWithPlugins.md)\<`TContext`, `TStepId`, `TEventMap`, `TStepMeta`, `THandlers`, `TPlugins`\>
