[**@rxova/journey-core**](../README.md)

---

[@rxova/journey-core](../README.md) / JourneyBuilder

# Type Alias: JourneyBuilder\<TContext, TStepId, TEventMap, TStepMeta, THandlers\>

```ts
type JourneyBuilder<TContext, TStepId, TEventMap, TStepMeta, THandlers> = {
  build: <TSteps, TGlobal>(
    input
  ) => JourneyBuilderDefinition<
    TContext,
    TStepId,
    TEventMap,
    TStepMeta,
    THandlers,
    JourneyStepBuilderHandledCustomEventMap<TStepId, TEventMap, TSteps>,
    JourneyBuilderGlobalHandledCustomEventKey<TEventMap, TGlobal>
  >;
  createStep: <TStepKey, TOn>(
    id,
    config?
  ) => JourneyStepBuilder<
    TContext,
    TStepId,
    TStepKey,
    TEventMap,
    TStepMeta,
    THandlers,
    JourneyStepBuilderHandledCustomEventKey<TEventMap, TOn>
  >;
  to: (stepId) => JourneyToBuilder<TContext, TStepId, TEventMap, THandlers>;
};
```

Defined in: [packages/core/src/journey-builder/types.ts:414](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/journey-builder/types.ts#L414)

## Type Parameters

| Type Parameter                                                   | Default type                 |
| ---------------------------------------------------------------- | ---------------------------- |
| `TContext` _extends_ [`JourneyJsonObject`](JourneyJsonObject.md) | -                            |
| `TStepId` _extends_ `string`                                     | -                            |
| `TEventMap` _extends_ `Record`\<`string`, `unknown`\>            | `Record`\<`never`, `never`\> |
| `TStepMeta`                                                      | `unknown`                    |
| `THandlers` _extends_ `Record`\<`string`, `unknown`\>            | `Record`\<`never`, `never`\> |

## Properties

### build

```ts
build: <TSteps, TGlobal>(input) =>
  JourneyBuilderDefinition<
    TContext,
    TStepId,
    TEventMap,
    TStepMeta,
    THandlers,
    JourneyStepBuilderHandledCustomEventMap<TStepId, TEventMap, TSteps>,
    JourneyBuilderGlobalHandledCustomEventKey<TEventMap, TGlobal>
  >;
```

Defined in: [packages/core/src/journey-builder/types.ts:439](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/journey-builder/types.ts#L439)

#### Type Parameters

| Type Parameter                                                                                                                                                                                                                           | Default type                                                                                      |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `TSteps` _extends_ readonly [`JourneyStepBuilder`](JourneyStepBuilder.md)\<`TContext`, `TStepId`, `TStepId`, `TEventMap`, `TStepMeta`, `THandlers`, [`JourneyBuilderCustomEventKey`](JourneyBuilderCustomEventKey.md)\<`TEventMap`\>\>[] | -                                                                                                 |
| `TGlobal` _extends_ \| `JourneyBuilderGlobalConfig`\<`TContext`, `TStepId`, `TEventMap`, `THandlers`\> \| `undefined`                                                                                                                    | \| `JourneyBuilderGlobalConfig`\<`TContext`, `TStepId`, `TEventMap`, `THandlers`\> \| `undefined` |

#### Parameters

| Parameter | Type                                                                                                            |
| --------- | --------------------------------------------------------------------------------------------------------------- |
| `input`   | `JourneyBuilderBuildInput`\<`TContext`, `TStepId`, `TEventMap`, `TStepMeta`, `THandlers`, `TSteps`, `TGlobal`\> |

#### Returns

[`JourneyBuilderDefinition`](JourneyBuilderDefinition.md)\<`TContext`, `TStepId`, `TEventMap`, `TStepMeta`, `THandlers`, `JourneyStepBuilderHandledCustomEventMap`\<`TStepId`, `TEventMap`, `TSteps`\>, `JourneyBuilderGlobalHandledCustomEventKey`\<`TEventMap`, `TGlobal`\>\>

---

### createStep

```ts
createStep: <TStepKey, TOn>(id, config?) =>
  JourneyStepBuilder<
    TContext,
    TStepId,
    TStepKey,
    TEventMap,
    TStepMeta,
    THandlers,
    JourneyStepBuilderHandledCustomEventKey<TEventMap, TOn>
  >;
```

Defined in: [packages/core/src/journey-builder/types.ts:421](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/journey-builder/types.ts#L421)

#### Type Parameters

| Type Parameter                                                                                                    | Default type                                                                                      |
| ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `TStepKey` _extends_ `TStepId`                                                                                    | -                                                                                                 |
| `TOn` _extends_ \| `JourneyStepBuilderOnConfig`\<`TContext`, `TStepId`, `TEventMap`, `THandlers`\> \| `undefined` | \| `JourneyStepBuilderOnConfig`\<`TContext`, `TStepId`, `TEventMap`, `THandlers`\> \| `undefined` |

#### Parameters

| Parameter | Type                                                                                              |
| --------- | ------------------------------------------------------------------------------------------------- |
| `id`      | `TStepKey`                                                                                        |
| `config?` | `JourneyStepBuilderConfig`\<`TContext`, `TStepId`, `TEventMap`, `TStepMeta`, `THandlers`, `TOn`\> |

#### Returns

[`JourneyStepBuilder`](JourneyStepBuilder.md)\<`TContext`, `TStepId`, `TStepKey`, `TEventMap`, `TStepMeta`, `THandlers`, `JourneyStepBuilderHandledCustomEventKey`\<`TEventMap`, `TOn`\>\>

---

### to

```ts
to: (stepId) => JourneyToBuilder<TContext, TStepId, TEventMap, THandlers>;
```

Defined in: [packages/core/src/journey-builder/types.ts:438](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/journey-builder/types.ts#L438)

#### Parameters

| Parameter | Type      |
| --------- | --------- |
| `stepId`  | `TStepId` |

#### Returns

[`JourneyToBuilder`](JourneyToBuilder.md)\<`TContext`, `TStepId`, `TEventMap`, `THandlers`\>
