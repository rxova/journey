[**@rxova/journey-core**](../README.md)

---

[@rxova/journey-core](../README.md) / JourneyTransitionUpdateContextArgsForEvent

# Type Alias: JourneyTransitionUpdateContextArgsForEvent\<TContext, TStepId, TEventMap, TEventType\>

```ts
type JourneyTransitionUpdateContextArgsForEvent<TContext, TStepId, TEventMap, TEventType> = {
  context: Readonly<TContext>;
  event: JourneyTransitionEventOfType<TStepId, TEventMap, TEventType>;
  from: TStepId;
  index: number;
  snapshot: JourneySnapshot<TContext, TStepId>;
  timeline: JourneyHistory<TStepId>["timeline"];
};
```

Defined in: [packages/core/src/types/transitions.types.ts:102](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/transitions.types.ts#L102)

## Type Parameters

| Type Parameter                                                                          |
| --------------------------------------------------------------------------------------- |
| `TContext` _extends_ [`JourneyJsonObject`](JourneyJsonObject.md)                        |
| `TStepId` _extends_ `string`                                                            |
| `TEventMap` _extends_ `Record`\<`string`, `unknown`\>                                   |
| `TEventType` _extends_ [`JourneyFullEventType`](JourneyFullEventType.md)\<`TEventMap`\> |

## Properties

### context

```ts
context: Readonly<TContext>;
```

Defined in: [packages/core/src/types/transitions.types.ts:109](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/transitions.types.ts#L109)

---

### event

```ts
event: JourneyTransitionEventOfType<TStepId, TEventMap, TEventType>;
```

Defined in: [packages/core/src/types/transitions.types.ts:113](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/transitions.types.ts#L113)

---

### from

```ts
from: TStepId;
```

Defined in: [packages/core/src/types/transitions.types.ts:110](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/transitions.types.ts#L110)

---

### index

```ts
index: number;
```

Defined in: [packages/core/src/types/transitions.types.ts:112](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/transitions.types.ts#L112)

---

### snapshot

```ts
snapshot: JourneySnapshot<TContext, TStepId>;
```

Defined in: [packages/core/src/types/transitions.types.ts:108](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/transitions.types.ts#L108)

---

### timeline

```ts
timeline: JourneyHistory < TStepId > ["timeline"];
```

Defined in: [packages/core/src/types/transitions.types.ts:111](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/transitions.types.ts#L111)
