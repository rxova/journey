[**@rxova/journey-react**](../README.md)

---

[@rxova/journey-react](../README.md) / JourneyLifecycleArgs

# Type Alias: JourneyLifecycleArgs\<TContext, TStepId, TEventMap, THandlers\>

```ts
type JourneyLifecycleArgs<TContext, TStepId, TEventMap, THandlers> = object;
```

Defined in: [core/src/types/transitions.types.ts:47](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/transitions.types.ts#L47)

## Type Parameters

| Type Parameter                                        |
| ----------------------------------------------------- |
| `TContext` _extends_ `JourneyJsonObject`              |
| `TStepId` _extends_ `string`                          |
| `TEventMap` _extends_ `Record`\<`string`, `unknown`\> |
| `THandlers` _extends_ `Record`\<`string`, `unknown`\> |

## Properties

### context

```ts
context: Readonly<TContext>;
```

Defined in: [core/src/types/transitions.types.ts:54](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/transitions.types.ts#L54)

---

### dispatch

```ts
dispatch: JourneyDispatch<TContext, TStepId, TEventMap>;
```

Defined in: [core/src/types/transitions.types.ts:62](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/transitions.types.ts#L62)

---

### event

```ts
event: object;
```

Defined in: [core/src/types/transitions.types.ts:57](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/transitions.types.ts#L57)

#### payload?

```ts
optional payload?: unknown;
```

#### type

```ts
type: string;
```

---

### from

```ts
from: TStepId;
```

Defined in: [core/src/types/transitions.types.ts:55](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/transitions.types.ts#L55)

---

### handlers

```ts
handlers: THandlers;
```

Defined in: [core/src/types/transitions.types.ts:60](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/transitions.types.ts#L60)

---

### label?

```ts
optional label?: string;
```

Defined in: [core/src/types/transitions.types.ts:59](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/transitions.types.ts#L59)

---

### signal

```ts
signal: AbortSignal;
```

Defined in: [core/src/types/transitions.types.ts:61](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/transitions.types.ts#L61)

---

### snapshot

```ts
snapshot: JourneySnapshot<TContext, TStepId>;
```

Defined in: [core/src/types/transitions.types.ts:53](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/transitions.types.ts#L53)

---

### to

```ts
to: TStepId | JourneyTerminal;
```

Defined in: [core/src/types/transitions.types.ts:56](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/transitions.types.ts#L56)

---

### transitionId

```ts
transitionId: string | null;
```

Defined in: [core/src/types/transitions.types.ts:58](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/transitions.types.ts#L58)
