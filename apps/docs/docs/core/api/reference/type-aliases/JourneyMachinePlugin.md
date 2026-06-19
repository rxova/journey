[**@rxova/journey-core**](../README.md)

---

[@rxova/journey-core](../README.md) / JourneyMachinePlugin

# Type Alias: JourneyMachinePlugin

```ts
type JourneyMachinePlugin = {
  __extension__?: object;
  name: string;
  setup: <TContext, TStepId, TEventMap, TStepMeta, THandlers>(
    context
  ) => JourneyMachinePluginHooks<TContext, TStepId, TEventMap, TStepMeta, THandlers>;
};
```

Defined in: [packages/core/src/types/machine.types.ts:182](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/machine.types.ts#L182)

Plugin contract for extending journey machines without bloating the base entrypoint.

## Properties

### \_\_extension\_\_?

```ts
optional __extension__?: object;
```

Defined in: [packages/core/src/types/machine.types.ts:184](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/machine.types.ts#L184)

---

### name

```ts
name: string;
```

Defined in: [packages/core/src/types/machine.types.ts:183](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/machine.types.ts#L183)

---

### setup

```ts
setup: <TContext, TStepId, TEventMap, TStepMeta, THandlers>(context) =>
  JourneyMachinePluginHooks<TContext, TStepId, TEventMap, TStepMeta, THandlers>;
```

Defined in: [packages/core/src/types/machine.types.ts:185](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/machine.types.ts#L185)

#### Type Parameters

| Type Parameter                                                   | Default type                 |
| ---------------------------------------------------------------- | ---------------------------- |
| `TContext` _extends_ [`JourneyJsonObject`](JourneyJsonObject.md) | -                            |
| `TStepId` _extends_ `string`                                     | -                            |
| `TEventMap` _extends_ `Record`\<`string`, `unknown`\>            | `Record`\<`never`, `never`\> |
| `TStepMeta`                                                      | `unknown`                    |
| `THandlers` _extends_ `Record`\<`string`, `unknown`\>            | `Record`\<`never`, `never`\> |

#### Parameters

| Parameter | Type                                                                                                                                      |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `context` | [`JourneyMachinePluginSetupContext`](JourneyMachinePluginSetupContext.md)\<`TContext`, `TStepId`, `TEventMap`, `TStepMeta`, `THandlers`\> |

#### Returns

[`JourneyMachinePluginHooks`](JourneyMachinePluginHooks.md)\<`TContext`, `TStepId`, `TEventMap`, `TStepMeta`, `THandlers`\>
