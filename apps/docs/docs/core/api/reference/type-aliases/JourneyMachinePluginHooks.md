[**@rxova/journey-core**](../README.md)

---

[@rxova/journey-core](../README.md) / JourneyMachinePluginHooks

# Type Alias: JourneyMachinePluginHooks\<TContext, TStepId, TEventMap, TStepMeta, THandlers, TExtension\>

```ts
type JourneyMachinePluginHooks<TContext, TStepId, TEventMap, TStepMeta, THandlers, TExtension> = {
  augmentMachine?: (context) => TExtension;
  dispose?: () => void;
  getDevtoolsFeatures?: (
    context
  ) => readonly JourneyMachineDevtoolsFeatureSpec<
    TContext,
    TStepId,
    TEventMap,
    TStepMeta,
    THandlers
  >[];
  hydrateSnapshot?: (snapshot) => JourneySnapshot<TContext, TStepId>;
  onSnapshotChange?: (change) => void;
};
```

Defined in: [packages/core/src/types/machine.types.ts:150](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/machine.types.ts#L150)

Hooks returned from a journey plugin setup call.

## Type Parameters

| Type Parameter                                                   | Default type                 |
| ---------------------------------------------------------------- | ---------------------------- |
| `TContext` _extends_ [`JourneyJsonObject`](JourneyJsonObject.md) | -                            |
| `TStepId` _extends_ `string`                                     | -                            |
| `TEventMap` _extends_ `Record`\<`string`, `unknown`\>            | `Record`\<`never`, `never`\> |
| `TStepMeta`                                                      | `unknown`                    |
| `THandlers` _extends_ `Record`\<`string`, `unknown`\>            | `Record`\<`never`, `never`\> |
| `TExtension` _extends_ `object`                                  | `Record`\<`never`, `never`\> |

## Properties

### augmentMachine?

```ts
optional augmentMachine?: (context) => TExtension;
```

Defined in: [packages/core/src/types/machine.types.ts:162](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/machine.types.ts#L162)

#### Parameters

| Parameter                 | Type                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `context`                 | \{ `journey`: [`JourneyDefinition`](JourneyDefinition.md)\<`TContext`, `TStepId`, `TEventMap`, `TStepMeta`, `THandlers`\>; `machine`: [`JourneyMachine`](JourneyMachine.md)\<`TContext`, `TStepId`, `TEventMap`, `TStepMeta`, `THandlers`\>; `resolvedJourney`: [`JourneyResolvedDefinition`](JourneyResolvedDefinition.md)\<`TContext`, `TStepId`, `TEventMap`, `TStepMeta`, `THandlers`\>; \} |
| `context.journey`         | [`JourneyDefinition`](JourneyDefinition.md)\<`TContext`, `TStepId`, `TEventMap`, `TStepMeta`, `THandlers`\>                                                                                                                                                                                                                                                                                     |
| `context.machine`         | [`JourneyMachine`](JourneyMachine.md)\<`TContext`, `TStepId`, `TEventMap`, `TStepMeta`, `THandlers`\>                                                                                                                                                                                                                                                                                           |
| `context.resolvedJourney` | [`JourneyResolvedDefinition`](JourneyResolvedDefinition.md)\<`TContext`, `TStepId`, `TEventMap`, `TStepMeta`, `THandlers`\>                                                                                                                                                                                                                                                                     |

#### Returns

`TExtension`

---

### dispose?

```ts
optional dispose?: () => void;
```

Defined in: [packages/core/src/types/machine.types.ts:178](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/machine.types.ts#L178)

#### Returns

`void`

---

### getDevtoolsFeatures?

```ts
optional getDevtoolsFeatures?: (context) => readonly JourneyMachineDevtoolsFeatureSpec<TContext, TStepId, TEventMap, TStepMeta, THandlers>[];
```

Defined in: [packages/core/src/types/machine.types.ts:167](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/machine.types.ts#L167)

#### Parameters

| Parameter                 | Type                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `context`                 | \{ `journey`: [`JourneyDefinition`](JourneyDefinition.md)\<`TContext`, `TStepId`, `TEventMap`, `TStepMeta`, `THandlers`\>; `machine`: [`JourneyMachine`](JourneyMachine.md)\<`TContext`, `TStepId`, `TEventMap`, `TStepMeta`, `THandlers`\>; `resolvedJourney`: [`JourneyResolvedDefinition`](JourneyResolvedDefinition.md)\<`TContext`, `TStepId`, `TEventMap`, `TStepMeta`, `THandlers`\>; \} |
| `context.journey`         | [`JourneyDefinition`](JourneyDefinition.md)\<`TContext`, `TStepId`, `TEventMap`, `TStepMeta`, `THandlers`\>                                                                                                                                                                                                                                                                                     |
| `context.machine`         | [`JourneyMachine`](JourneyMachine.md)\<`TContext`, `TStepId`, `TEventMap`, `TStepMeta`, `THandlers`\>                                                                                                                                                                                                                                                                                           |
| `context.resolvedJourney` | [`JourneyResolvedDefinition`](JourneyResolvedDefinition.md)\<`TContext`, `TStepId`, `TEventMap`, `TStepMeta`, `THandlers`\>                                                                                                                                                                                                                                                                     |

#### Returns

readonly [`JourneyMachineDevtoolsFeatureSpec`](JourneyMachineDevtoolsFeatureSpec.md)\<`TContext`, `TStepId`, `TEventMap`, `TStepMeta`, `THandlers`\>[]

---

### hydrateSnapshot?

```ts
optional hydrateSnapshot?: (snapshot) => JourneySnapshot<TContext, TStepId>;
```

Defined in: [packages/core/src/types/machine.types.ts:158](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/machine.types.ts#L158)

#### Parameters

| Parameter  | Type                                                             |
| ---------- | ---------------------------------------------------------------- |
| `snapshot` | [`JourneySnapshot`](JourneySnapshot.md)\<`TContext`, `TStepId`\> |

#### Returns

[`JourneySnapshot`](JourneySnapshot.md)\<`TContext`, `TStepId`\>

---

### onSnapshotChange?

```ts
optional onSnapshotChange?: (change) => void;
```

Defined in: [packages/core/src/types/machine.types.ts:161](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/machine.types.ts#L161)

#### Parameters

| Parameter | Type                                                          |
| --------- | ------------------------------------------------------------- |
| `change`  | `JourneyMachinePluginSnapshotChange`\<`TContext`, `TStepId`\> |

#### Returns

`void`
