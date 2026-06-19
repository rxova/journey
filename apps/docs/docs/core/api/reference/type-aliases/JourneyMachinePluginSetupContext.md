[**@rxova/journey-core**](../README.md)

---

[@rxova/journey-core](../README.md) / JourneyMachinePluginSetupContext

# Type Alias: JourneyMachinePluginSetupContext\<TContext, TStepId, TEventMap, TStepMeta, THandlers\>

```ts
type JourneyMachinePluginSetupContext<TContext, TStepId, TEventMap, TStepMeta, THandlers> = {
  buildInitialSnapshot: () => JourneySnapshot<TContext, TStepId>;
  journey: JourneyDefinition<TContext, TStepId, TEventMap, TStepMeta, THandlers>;
  options: {
    defaultTimeoutMs: number | undefined;
    requireExplicitCompletion: boolean;
  };
  resolvedJourney: JourneyResolvedDefinition<TContext, TStepId, TEventMap, TStepMeta, THandlers>;
};
```

Defined in: [packages/core/src/types/machine.types.ts:43](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/machine.types.ts#L43)

Setup context passed to journey plugins when a machine is created.

## Type Parameters

| Type Parameter                                                   | Default type                 |
| ---------------------------------------------------------------- | ---------------------------- |
| `TContext` _extends_ [`JourneyJsonObject`](JourneyJsonObject.md) | -                            |
| `TStepId` _extends_ `string`                                     | -                            |
| `TEventMap` _extends_ `Record`\<`string`, `unknown`\>            | `Record`\<`never`, `never`\> |
| `TStepMeta`                                                      | `unknown`                    |
| `THandlers` _extends_ `Record`\<`string`, `unknown`\>            | `Record`\<`never`, `never`\> |

## Properties

### buildInitialSnapshot

```ts
buildInitialSnapshot: () => JourneySnapshot<TContext, TStepId>;
```

Defined in: [packages/core/src/types/machine.types.ts:56](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/machine.types.ts#L56)

#### Returns

[`JourneySnapshot`](JourneySnapshot.md)\<`TContext`, `TStepId`\>

---

### journey

```ts
journey: JourneyDefinition<TContext, TStepId, TEventMap, TStepMeta, THandlers>;
```

Defined in: [packages/core/src/types/machine.types.ts:50](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/machine.types.ts#L50)

---

### options

```ts
options: {
  defaultTimeoutMs: number | undefined;
  requireExplicitCompletion: boolean;
}
```

Defined in: [packages/core/src/types/machine.types.ts:52](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/machine.types.ts#L52)

| Name                        | Type                    | Defined in                                                                                                                                                                 |
| --------------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `defaultTimeoutMs`          | `number` \| `undefined` | [packages/core/src/types/machine.types.ts:54](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/machine.types.ts#L54) |
| `requireExplicitCompletion` | `boolean`               | [packages/core/src/types/machine.types.ts:53](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/machine.types.ts#L53) |

---

### resolvedJourney

```ts
resolvedJourney: JourneyResolvedDefinition<TContext, TStepId, TEventMap, TStepMeta, THandlers>;
```

Defined in: [packages/core/src/types/machine.types.ts:51](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/machine.types.ts#L51)
