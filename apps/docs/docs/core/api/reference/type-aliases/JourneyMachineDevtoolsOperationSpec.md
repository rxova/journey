[**@rxova/journey-core**](../README.md)

---

[@rxova/journey-core](../README.md) / JourneyMachineDevtoolsOperationSpec

# Type Alias: JourneyMachineDevtoolsOperationSpec\<TContext, TStepId, TEventMap, TStepMeta, THandlers\>

```ts
type JourneyMachineDevtoolsOperationSpec<TContext, TStepId, TEventMap, TStepMeta, THandlers> = {
  description?: string;
  fields?: readonly JourneyMachineDevtoolsFieldSpec[];
  id: string;
  label: string;
  mutates: boolean;
  output: JourneyMachineDevtoolsOperationResultKind;
  run: (
    context
  ) =>
    | JourneyMachineDevtoolsOperationResult<TContext, TStepId>
    | Promise<JourneyMachineDevtoolsOperationResult<TContext, TStepId>>;
};
```

Defined in: [packages/core/src/types/machine.types.ts:107](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/machine.types.ts#L107)

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

Defined in: [packages/core/src/types/machine.types.ts:116](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/machine.types.ts#L116)

---

### fields?

```ts
optional fields?: readonly JourneyMachineDevtoolsFieldSpec[];
```

Defined in: [packages/core/src/types/machine.types.ts:119](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/machine.types.ts#L119)

---

### id

```ts
id: string;
```

Defined in: [packages/core/src/types/machine.types.ts:114](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/machine.types.ts#L114)

---

### label

```ts
label: string;
```

Defined in: [packages/core/src/types/machine.types.ts:115](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/machine.types.ts#L115)

---

### mutates

```ts
mutates: boolean;
```

Defined in: [packages/core/src/types/machine.types.ts:117](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/machine.types.ts#L117)

---

### output

```ts
output: JourneyMachineDevtoolsOperationResultKind;
```

Defined in: [packages/core/src/types/machine.types.ts:118](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/machine.types.ts#L118)

---

### run

```ts
run: (context) =>
  | JourneyMachineDevtoolsOperationResult<TContext, TStepId>
| Promise<JourneyMachineDevtoolsOperationResult<TContext, TStepId>>;
```

Defined in: [packages/core/src/types/machine.types.ts:120](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/machine.types.ts#L120)

#### Parameters

| Parameter                 | Type                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `context`                 | \{ `input`: `Record`\<`string`, `unknown`\> \| `undefined`; `journey`: [`JourneyDefinition`](JourneyDefinition.md)\<`TContext`, `TStepId`, `TEventMap`, `TStepMeta`, `THandlers`\>; `machine`: [`JourneyMachine`](JourneyMachine.md)\<`TContext`, `TStepId`, `TEventMap`, `TStepMeta`, `THandlers`\>; `resolvedJourney`: [`JourneyResolvedDefinition`](JourneyResolvedDefinition.md)\<`TContext`, `TStepId`, `TEventMap`, `TStepMeta`, `THandlers`\>; \} |
| `context.input`           | `Record`\<`string`, `unknown`\> \| `undefined`                                                                                                                                                                                                                                                                                                                                                                                                           |
| `context.journey`         | [`JourneyDefinition`](JourneyDefinition.md)\<`TContext`, `TStepId`, `TEventMap`, `TStepMeta`, `THandlers`\>                                                                                                                                                                                                                                                                                                                                              |
| `context.machine`         | [`JourneyMachine`](JourneyMachine.md)\<`TContext`, `TStepId`, `TEventMap`, `TStepMeta`, `THandlers`\>                                                                                                                                                                                                                                                                                                                                                    |
| `context.resolvedJourney` | [`JourneyResolvedDefinition`](JourneyResolvedDefinition.md)\<`TContext`, `TStepId`, `TEventMap`, `TStepMeta`, `THandlers`\>                                                                                                                                                                                                                                                                                                                              |

#### Returns

\| [`JourneyMachineDevtoolsOperationResult`](JourneyMachineDevtoolsOperationResult.md)\<`TContext`, `TStepId`\>
\| `Promise`\<[`JourneyMachineDevtoolsOperationResult`](JourneyMachineDevtoolsOperationResult.md)\<`TContext`, `TStepId`\>\>
