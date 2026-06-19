[**@rxova/journey-react**](../README.md)

---

[@rxova/journey-react](../README.md) / JourneyRuntime

# Type Alias: JourneyRuntime\<TContext, TStepId, TEventMap, TStepMeta, TPlugins, THandlers\>

```ts
type JourneyRuntime<TContext, TStepId, TEventMap, TStepMeta, TPlugins, THandlers> = object;
```

Defined in: [react/src/types.ts:81](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/react/src/types.ts#L81)

## Type Parameters

| Type Parameter                                                                    | Default type                 |
| --------------------------------------------------------------------------------- | ---------------------------- |
| `TContext` _extends_ `JourneyJsonObject`                                          | -                            |
| `TStepId` _extends_ `string`                                                      | -                            |
| `TEventMap` _extends_ `Record`\<`string`, `unknown`\>                             | `Record`\<`never`, `never`\> |
| `TStepMeta`                                                                       | `unknown`                    |
| `TPlugins` _extends_ readonly [`JourneyMachinePlugin`](JourneyMachinePlugin.md)[] | \[\]                         |
| `THandlers` _extends_ `Record`\<`string`, `unknown`\>                             | `Record`\<`never`, `never`\> |

## Properties

### dispose

```ts
dispose: () => void;
```

Defined in: [react/src/types.ts:90](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/react/src/types.ts#L90)

#### Returns

`void`

---

### JourneyProvider

```ts
JourneyProvider: React.ComponentType<JourneyProviderProps<TStepId>>;
```

Defined in: [react/src/types.ts:106](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/react/src/types.ts#L106)

---

### machine

```ts
machine: JourneyMachineWithPlugins<TContext, TStepId, TEventMap, TStepMeta, THandlers, TPlugins>;
```

Defined in: [react/src/types.ts:89](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/react/src/types.ts#L89)

---

### StepRenderer

```ts
StepRenderer: React.ComponentType<{
  fallback?: React.ReactNode;
}>;
```

Defined in: [react/src/types.ts:107](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/react/src/types.ts#L107)

---

### useJourneyApi

```ts
useJourneyApi: () => JourneyApi<TContext, TStepId, TEventMap, TStepMeta>;
```

Defined in: [react/src/types.ts:97](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/react/src/types.ts#L97)

#### Returns

[`JourneyApi`](JourneyApi.md)\<`TContext`, `TStepId`, `TEventMap`, `TStepMeta`\>

---

### useJourneyComputed

```ts
useJourneyComputed: () => JourneyComputed<TStepId>;
```

Defined in: [react/src/types.ts:92](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/react/src/types.ts#L92)

#### Returns

[`JourneyComputed`](JourneyComputed.md)\<`TStepId`\>

---

### useJourneyEvent

```ts
useJourneyEvent: (listener) => void;
```

Defined in: [react/src/types.ts:98](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/react/src/types.ts#L98)

#### Parameters

| Parameter  | Type                |
| ---------- | ------------------- |
| `listener` | (`event`) => `void` |

#### Returns

`void`

---

### useJourneySelector

```ts
useJourneySelector: <TSelected>(selector, equalityFn?) => TSelected;
```

Defined in: [react/src/types.ts:93](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/react/src/types.ts#L93)

#### Type Parameters

| Type Parameter |
| -------------- |
| `TSelected`    |

#### Parameters

| Parameter     | Type                                                                          |
| ------------- | ----------------------------------------------------------------------------- |
| `selector`    | [`JourneySelector`](JourneySelector.md)\<`TContext`, `TStepId`, `TSelected`\> |
| `equalityFn?` | [`JourneyEqualityFn`](JourneyEqualityFn.md)\<`TSelected`\>                    |

#### Returns

`TSelected`

---

### useJourneySnapshot

```ts
useJourneySnapshot: () => JourneySnapshot<TContext, TStepId>;
```

Defined in: [react/src/types.ts:91](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/react/src/types.ts#L91)

#### Returns

[`JourneySnapshot`](JourneySnapshot.md)\<`TContext`, `TStepId`\>

---

### useJourneyStepLifecycle

```ts
useJourneyStepLifecycle: (stepId, callbacks) => void;
```

Defined in: [react/src/types.ts:99](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/react/src/types.ts#L99)

#### Parameters

| Parameter            | Type                                                                  |
| -------------------- | --------------------------------------------------------------------- |
| `stepId`             | `TStepId`                                                             |
| `callbacks`          | \{ `onEnter?`: (`args`) => `void`; `onLeave?`: (`args`) => `void`; \} |
| `callbacks.onEnter?` | (`args`) => `void`                                                    |
| `callbacks.onLeave?` | (`args`) => `void`                                                    |

#### Returns

`void`
