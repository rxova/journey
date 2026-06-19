[**@rxova/journey-core**](../README.md)

---

[@rxova/journey-core](../README.md) / JourneyMachineDevtoolsFeatureSpec

# Type Alias: JourneyMachineDevtoolsFeatureSpec\<TContext, TStepId, TEventMap, TStepMeta, THandlers\>

```ts
type JourneyMachineDevtoolsFeatureSpec<TContext, TStepId, TEventMap, TStepMeta, THandlers> = {
  description?: string;
  id: string;
  label: string;
  operations: readonly JourneyMachineDevtoolsOperationSpec<
    TContext,
    TStepId,
    TEventMap,
    TStepMeta,
    THandlers
  >[];
};
```

Defined in: [packages/core/src/types/machine.types.ts:130](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/machine.types.ts#L130)

## Type Parameters

| Type Parameter                                                   | Default type                 |
| ---------------------------------------------------------------- | ---------------------------- |
| `TContext` _extends_ [`JourneyJsonObject`](JourneyJsonObject.md) | -                            |
| `TStepId` _extends_ `string`                                     | -                            |
| `TEventMap` _extends_ `Record`\<`string`, `unknown`\>            | `Record`\<`never`, `never`\> |
| `TStepMeta`                                                      | `unknown`                    |
| `THandlers` _extends_ `Record`\<`string`, `unknown`\>            | `Record`\<`never`, `never`\> |

## Properties

### description?

```ts
optional description?: string;
```

Defined in: [packages/core/src/types/machine.types.ts:139](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/machine.types.ts#L139)

---

### id

```ts
id: string;
```

Defined in: [packages/core/src/types/machine.types.ts:137](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/machine.types.ts#L137)

---

### label

```ts
label: string;
```

Defined in: [packages/core/src/types/machine.types.ts:138](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/machine.types.ts#L138)

---

### operations

```ts
operations: readonly JourneyMachineDevtoolsOperationSpec<TContext, TStepId, TEventMap, TStepMeta, THandlers>[];
```

Defined in: [packages/core/src/types/machine.types.ts:140](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/machine.types.ts#L140)
