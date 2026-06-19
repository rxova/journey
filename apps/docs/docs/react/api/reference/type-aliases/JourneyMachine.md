[**@rxova/journey-react**](../README.md)

---

[@rxova/journey-react](../README.md) / JourneyMachine

# Type Alias: JourneyMachine\<TContext, TStepId, TEventMap, TStepMeta, THandlers\>

```ts
type JourneyMachine<TContext, TStepId, TEventMap, TStepMeta, THandlers> =
  JourneyTypeParam<THandlers> & object;
```

Defined in: [core/src/types/machine.types.ts:283](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/machine.types.ts#L283)

Runtime machine API for reading snapshots, sending events, and controlling flow.

## Type Declaration

### clearStepError

```ts
clearStepError: (stepId?) => Promise<JourneySnapshot<TContext, TStepId>>;
```

#### Parameters

| Parameter | Type      |
| --------- | --------- |
| `stepId?` | `TStepId` |

#### Returns

`Promise`\<[`JourneySnapshot`](JourneySnapshot.md)\<`TContext`, `TStepId`\>\>

### completeJourney

```ts
completeJourney: (payload?) => Promise<JourneySendResult<TContext, TStepId>>;
```

#### Parameters

| Parameter  | Type                                                                |
| ---------- | ------------------------------------------------------------------- |
| `payload?` | `JourneyPayloadForDefaultEvent`\<`TEventMap`, `"completeJourney"`\> |

#### Returns

`Promise`\<[`JourneySendResult`](JourneySendResult.md)\<`TContext`, `TStepId`\>\>

### dispose

```ts
dispose: () => void;
```

#### Returns

`void`

### getComputed

```ts
getComputed: () => JourneyComputed<TStepId>;
```

#### Returns

[`JourneyComputed`](JourneyComputed.md)\<`TStepId`\>

### getSnapshot

```ts
getSnapshot: () => JourneySnapshot<TContext, TStepId>;
```

#### Returns

[`JourneySnapshot`](JourneySnapshot.md)\<`TContext`, `TStepId`\>

### getStepMeta

```ts
getStepMeta: (stepId) => TStepMeta | undefined;
```

#### Parameters

| Parameter | Type      |
| --------- | --------- |
| `stepId`  | `TStepId` |

#### Returns

`TStepMeta` \| `undefined`

### goToLastVisitedStep

```ts
goToLastVisitedStep: () => Promise<JourneySendResult<TContext, TStepId>>;
```

#### Returns

`Promise`\<[`JourneySendResult`](JourneySendResult.md)\<`TContext`, `TStepId`\>\>

### goToNextStep

```ts
goToNextStep: () => Promise<JourneySendResult<TContext, TStepId>>;
```

#### Returns

`Promise`\<[`JourneySendResult`](JourneySendResult.md)\<`TContext`, `TStepId`\>\>

### goToPreviousStep

```ts
goToPreviousStep: (steps?) => Promise<JourneySendResult<TContext, TStepId>>;
```

#### Parameters

| Parameter | Type     |
| --------- | -------- |
| `steps?`  | `number` |

#### Returns

`Promise`\<[`JourneySendResult`](JourneySendResult.md)\<`TContext`, `TStepId`\>\>

### goToStepById

```ts
goToStepById: (stepId) => Promise<JourneySendResult<TContext, TStepId>>;
```

#### Parameters

| Parameter | Type      |
| --------- | --------- |
| `stepId`  | `TStepId` |

#### Returns

`Promise`\<[`JourneySendResult`](JourneySendResult.md)\<`TContext`, `TStepId`\>\>

### resetJourney

```ts
resetJourney: () => Promise<JourneySnapshot<TContext, TStepId>>;
```

#### Returns

`Promise`\<[`JourneySnapshot`](JourneySnapshot.md)\<`TContext`, `TStepId`\>\>

### send

```ts
send: (event) => Promise<JourneySendResult<TContext, TStepId>>;
```

#### Parameters

| Parameter | Type                                         |
| --------- | -------------------------------------------- |
| `event`   | `JourneySendEvent`\<`TStepId`, `TEventMap`\> |

#### Returns

`Promise`\<[`JourneySendResult`](JourneySendResult.md)\<`TContext`, `TStepId`\>\>

### startJourney

```ts
startJourney: () => Promise<JourneySnapshot<TContext, TStepId>>;
```

#### Returns

`Promise`\<[`JourneySnapshot`](JourneySnapshot.md)\<`TContext`, `TStepId`\>\>

### subscribe

```ts
subscribe: (listener) => () => void;
```

#### Parameters

| Parameter  | Type         |
| ---------- | ------------ |
| `listener` | () => `void` |

#### Returns

() => `void`

### subscribeComplete

```ts
subscribeComplete: (listener) => () => void;
```

#### Parameters

| Parameter  | Type                |
| ---------- | ------------------- |
| `listener` | (`event`) => `void` |

#### Returns

() => `void`

### subscribeEvent

```ts
subscribeEvent: (listener) => () => void;
```

#### Parameters

| Parameter  | Type                |
| ---------- | ------------------- |
| `listener` | (`event`) => `void` |

#### Returns

() => `void`

### subscribeReset

```ts
subscribeReset: (listener) => () => void;
```

#### Parameters

| Parameter  | Type                |
| ---------- | ------------------- |
| `listener` | (`event`) => `void` |

#### Returns

() => `void`

### subscribeSelector

```ts
subscribeSelector: <TSelected>(selector, listener, equalityFn?) => () => void;
```

#### Type Parameters

| Type Parameter |
| -------------- |
| `TSelected`    |

#### Parameters

| Parameter     | Type                                                                          |
| ------------- | ----------------------------------------------------------------------------- |
| `selector`    | [`JourneySelector`](JourneySelector.md)\<`TContext`, `TStepId`, `TSelected`\> |
| `listener`    | (`next`, `previous`) => `void`                                                |
| `equalityFn?` | [`JourneyEqualityFn`](JourneyEqualityFn.md)\<`TSelected`\>                    |

#### Returns

() => `void`

### subscribeStart

```ts
subscribeStart: (listener) => () => void;
```

#### Parameters

| Parameter  | Type                |
| ---------- | ------------------- |
| `listener` | (`event`) => `void` |

#### Returns

() => `void`

### subscribeTerminate

```ts
subscribeTerminate: (listener) => () => void;
```

#### Parameters

| Parameter  | Type                |
| ---------- | ------------------- |
| `listener` | (`event`) => `void` |

#### Returns

() => `void`

### terminateJourney

```ts
terminateJourney: (payload?) => Promise<JourneySendResult<TContext, TStepId>>;
```

#### Parameters

| Parameter  | Type                                                                 |
| ---------- | -------------------------------------------------------------------- |
| `payload?` | `JourneyPayloadForDefaultEvent`\<`TEventMap`, `"terminateJourney"`\> |

#### Returns

`Promise`\<[`JourneySendResult`](JourneySendResult.md)\<`TContext`, `TStepId`\>\>

### updateContext

```ts
updateContext: (updater) => Promise<JourneySnapshot<TContext, TStepId>>;
```

#### Parameters

| Parameter | Type                      |
| --------- | ------------------------- |
| `updater` | (`context`) => `TContext` |

#### Returns

`Promise`\<[`JourneySnapshot`](JourneySnapshot.md)\<`TContext`, `TStepId`\>\>

## Type Parameters

| Type Parameter                                        | Default type                 |
| ----------------------------------------------------- | ---------------------------- |
| `TContext` _extends_ `JourneyJsonObject`              | -                            |
| `TStepId` _extends_ `string`                          | -                            |
| `TEventMap` _extends_ `Record`\<`string`, `unknown`\> | `Record`\<`never`, `never`\> |
| `TStepMeta`                                           | `unknown`                    |
| `THandlers` _extends_ `Record`\<`string`, `unknown`\> | `Record`\<`never`, `never`\> |
