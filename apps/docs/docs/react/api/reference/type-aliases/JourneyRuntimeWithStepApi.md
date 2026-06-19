[**@rxova/journey-react**](../README.md)

---

[@rxova/journey-react](../README.md) / JourneyRuntimeWithStepApi

# Type Alias: JourneyRuntimeWithStepApi\<TContext, TStepId, TEventMap, TStepMeta, TPlugins, THandlers, TStepHandledCustomEventMap, TGlobalHandledCustomEventType\>

```ts
type JourneyRuntimeWithStepApi<
  TContext,
  TStepId,
  TEventMap,
  TStepMeta,
  TPlugins,
  THandlers,
  TStepHandledCustomEventMap,
  TGlobalHandledCustomEventType
> = JourneyRuntime<TContext, TStepId, TEventMap, TStepMeta, TPlugins, THandlers> & object;
```

Defined in: [react/src/types.ts:124](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/react/src/types.ts#L124)

## Type Declaration

### useStepApi

```ts
useStepApi: <TStepKey>(stepId) =>
  StepScopedJourneyApi<
    TContext,
    TStepId,
    TEventMap,
    Extract<
      TStepHandledCustomEventMap[TStepKey] | TGlobalHandledCustomEventType,
      keyof TEventMap & string
    >,
    TStepMeta
  >;
```

#### Type Parameters

| Type Parameter                 |
| ------------------------------ |
| `TStepKey` _extends_ `TStepId` |

#### Parameters

| Parameter | Type       |
| --------- | ---------- |
| `stepId`  | `TStepKey` |

#### Returns

[`StepScopedJourneyApi`](StepScopedJourneyApi.md)\<`TContext`, `TStepId`, `TEventMap`, `Extract`\<
\| `TStepHandledCustomEventMap`\[`TStepKey`\]
\| `TGlobalHandledCustomEventType`, keyof `TEventMap` & `string`\>, `TStepMeta`\>

## Type Parameters

| Type Parameter                                                                                              | Default type                   |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------ |
| `TContext` _extends_ `JourneyJsonObject`                                                                    | -                              |
| `TStepId` _extends_ `string`                                                                                | -                              |
| `TEventMap` _extends_ `Record`\<`string`, `unknown`\>                                                       | `Record`\<`never`, `never`\>   |
| `TStepMeta`                                                                                                 | `unknown`                      |
| `TPlugins` _extends_ readonly [`JourneyMachinePlugin`](JourneyMachinePlugin.md)[]                           | \[\]                           |
| `THandlers` _extends_ `Record`\<`string`, `unknown`\>                                                       | `Record`\<`never`, `never`\>   |
| `TStepHandledCustomEventMap` _extends_ `Record`\<`TStepId`, `JourneyBuilderCustomEventKey`\<`TEventMap`\>\> | `Record`\<`TStepId`, `never`\> |
| `TGlobalHandledCustomEventType` _extends_ `JourneyBuilderCustomEventKey`\<`TEventMap`\>                     | `never`                        |
