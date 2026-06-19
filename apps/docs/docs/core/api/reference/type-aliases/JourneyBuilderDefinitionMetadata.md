[**@rxova/journey-core**](../README.md)

---

[@rxova/journey-core](../README.md) / JourneyBuilderDefinitionMetadata

# Type Alias: JourneyBuilderDefinitionMetadata\<TStepId, TEventMap, TStepHandledCustomEventMap, TGlobalHandledCustomEventType\>

```ts
type JourneyBuilderDefinitionMetadata<
  TStepId,
  TEventMap,
  TStepHandledCustomEventMap,
  TGlobalHandledCustomEventType
> = {
  [journeyBuilderDefinitionBrand]?: {
    globalHandledCustomEvents: TGlobalHandledCustomEventType;
    stepHandledCustomEvents: TStepHandledCustomEventMap;
  };
};
```

Defined in: [packages/core/src/journey-builder/types.ts:347](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/journey-builder/types.ts#L347)

## Type Parameters

| Type Parameter                                                                                                                                 | Default type                   |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| `TStepId` _extends_ `string`                                                                                                                   | -                              |
| `TEventMap` _extends_ `Record`\<`string`, `unknown`\>                                                                                          | -                              |
| `TStepHandledCustomEventMap` _extends_ `Record`\<`TStepId`, [`JourneyBuilderCustomEventKey`](JourneyBuilderCustomEventKey.md)\<`TEventMap`\>\> | `Record`\<`TStepId`, `never`\> |
| `TGlobalHandledCustomEventType` _extends_ [`JourneyBuilderCustomEventKey`](JourneyBuilderCustomEventKey.md)\<`TEventMap`\>                     | `never`                        |

## Properties

### \[journeyBuilderDefinitionBrand\]?

```ts
readonly optional [journeyBuilderDefinitionBrand]?: {
  globalHandledCustomEvents: TGlobalHandledCustomEventType;
  stepHandledCustomEvents: TStepHandledCustomEventMap;
};
```

Defined in: [packages/core/src/journey-builder/types.ts:354](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/journey-builder/types.ts#L354)

| Name                        | Type                            | Defined in                                                                                                                                                                       |
| --------------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `globalHandledCustomEvents` | `TGlobalHandledCustomEventType` | [packages/core/src/journey-builder/types.ts:356](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/journey-builder/types.ts#L356) |
| `stepHandledCustomEvents`   | `TStepHandledCustomEventMap`    | [packages/core/src/journey-builder/types.ts:355](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/journey-builder/types.ts#L355) |
