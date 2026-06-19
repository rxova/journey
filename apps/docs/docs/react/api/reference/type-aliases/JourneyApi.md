[**@rxova/journey-react**](../README.md)

---

[@rxova/journey-react](../README.md) / JourneyApi

# Type Alias: JourneyApi\<TContext, TStepId, TEventMap, TStepMeta\>

```ts
type JourneyApi<TContext, TStepId, TEventMap, TStepMeta> = object;
```

Defined in: [react/src/types.ts:30](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/react/src/types.ts#L30)

## Type Parameters

| Type Parameter                                        | Default type                 |
| ----------------------------------------------------- | ---------------------------- |
| `TContext` _extends_ `JourneyJsonObject`              | -                            |
| `TStepId` _extends_ `string`                          | -                            |
| `TEventMap` _extends_ `Record`\<`string`, `unknown`\> | `Record`\<`never`, `never`\> |
| `TStepMeta`                                           | `unknown`                    |

## Properties

### clearStepError

```ts
clearStepError: (stepId?) => Promise<JourneySnapshot<TContext, TStepId>>;
```

Defined in: [react/src/types.ts:50](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/react/src/types.ts#L50)

#### Parameters

| Parameter | Type      |
| --------- | --------- |
| `stepId?` | `TStepId` |

#### Returns

`Promise`\<[`JourneySnapshot`](JourneySnapshot.md)\<`TContext`, `TStepId`\>\>

---

### completeJourney

```ts
completeJourney: (payload?) => Promise<JourneySendResult<TContext, TStepId>>;
```

Defined in: [react/src/types.ts:45](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/react/src/types.ts#L45)

#### Parameters

| Parameter  | Type                                                    |
| ---------- | ------------------------------------------------------- |
| `payload?` | `JourneyPayloadFor`\<`TEventMap`, `"completeJourney"`\> |

#### Returns

`Promise`\<[`JourneySendResult`](JourneySendResult.md)\<`TContext`, `TStepId`\>\>

---

### getStepMeta

```ts
getStepMeta: (stepId) => TStepMeta | undefined;
```

Defined in: [react/src/types.ts:54](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/react/src/types.ts#L54)

#### Parameters

| Parameter | Type      |
| --------- | --------- |
| `stepId`  | `TStepId` |

#### Returns

`TStepMeta` \| `undefined`

---

### goToLastVisitedStep

```ts
goToLastVisitedStep: () => Promise<JourneySendResult<TContext, TStepId>>;
```

Defined in: [react/src/types.ts:49](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/react/src/types.ts#L49)

#### Returns

`Promise`\<[`JourneySendResult`](JourneySendResult.md)\<`TContext`, `TStepId`\>\>

---

### goToNextStep

```ts
goToNextStep: () => Promise<JourneySendResult<TContext, TStepId>>;
```

Defined in: [react/src/types.ts:40](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/react/src/types.ts#L40)

#### Returns

`Promise`\<[`JourneySendResult`](JourneySendResult.md)\<`TContext`, `TStepId`\>\>

---

### goToPreviousStep

```ts
goToPreviousStep: (steps?) => Promise<JourneySendResult<TContext, TStepId>>;
```

Defined in: [react/src/types.ts:48](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/react/src/types.ts#L48)

#### Parameters

| Parameter | Type     |
| --------- | -------- |
| `steps?`  | `number` |

#### Returns

`Promise`\<[`JourneySendResult`](JourneySendResult.md)\<`TContext`, `TStepId`\>\>

---

### goToStepById

```ts
goToStepById: (stepId) => Promise<JourneySendResult<TContext, TStepId>>;
```

Defined in: [react/src/types.ts:41](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/react/src/types.ts#L41)

#### Parameters

| Parameter | Type      |
| --------- | --------- |
| `stepId`  | `TStepId` |

#### Returns

`Promise`\<[`JourneySendResult`](JourneySendResult.md)\<`TContext`, `TStepId`\>\>

---

### resetJourney

```ts
resetJourney: () => Promise<JourneySnapshot<TContext, TStepId>>;
```

Defined in: [react/src/types.ts:55](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/react/src/types.ts#L55)

#### Returns

`Promise`\<[`JourneySnapshot`](JourneySnapshot.md)\<`TContext`, `TStepId`\>\>

---

### send

```ts
send: (event) => Promise<JourneySendResult<TContext, TStepId>>;
```

Defined in: [react/src/types.ts:37](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/react/src/types.ts#L37)

#### Parameters

| Parameter | Type                                         |
| --------- | -------------------------------------------- |
| `event`   | `JourneySendEvent`\<`TStepId`, `TEventMap`\> |

#### Returns

`Promise`\<[`JourneySendResult`](JourneySendResult.md)\<`TContext`, `TStepId`\>\>

---

### startJourney

```ts
startJourney: () => Promise<JourneySnapshot<TContext, TStepId>>;
```

Defined in: [react/src/types.ts:36](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/react/src/types.ts#L36)

#### Returns

`Promise`\<[`JourneySnapshot`](JourneySnapshot.md)\<`TContext`, `TStepId`\>\>

---

### terminateJourney

```ts
terminateJourney: (payload?) => Promise<JourneySendResult<TContext, TStepId>>;
```

Defined in: [react/src/types.ts:42](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/react/src/types.ts#L42)

#### Parameters

| Parameter  | Type                                                     |
| ---------- | -------------------------------------------------------- |
| `payload?` | `JourneyPayloadFor`\<`TEventMap`, `"terminateJourney"`\> |

#### Returns

`Promise`\<[`JourneySendResult`](JourneySendResult.md)\<`TContext`, `TStepId`\>\>

---

### updateContext

```ts
updateContext: (updater) => Promise<JourneySnapshot<TContext, TStepId>>;
```

Defined in: [react/src/types.ts:51](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/react/src/types.ts#L51)

#### Parameters

| Parameter | Type                      |
| --------- | ------------------------- |
| `updater` | (`context`) => `TContext` |

#### Returns

`Promise`\<[`JourneySnapshot`](JourneySnapshot.md)\<`TContext`, `TStepId`\>\>
