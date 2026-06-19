[**@rxova/journey-core**](../README.md)

---

[@rxova/journey-core](../README.md) / JourneyBuilderTerminalCandidate

# Type Alias: JourneyBuilderTerminalCandidate\<TContext, TStepId, TEventMap, THandlers, TEventType\>

```ts
type JourneyBuilderTerminalCandidate<TContext, TStepId, TEventMap, THandlers, TEventType> = {
  label?: string;
  onEnter?: JourneyBuilderLifecycle<TContext, TStepId, TEventMap, THandlers>;
  onLeave?: JourneyBuilderLifecycle<TContext, TStepId, TEventMap, THandlers>;
  timeoutMs?: number;
  updateContext?: JourneyBuilderUpdateContext<TContext, TStepId, TEventMap, TEventType>;
  when?: JourneyBuilderGuard<TContext, TStepId, TEventMap, THandlers, TEventType>;
};
```

Defined in: [packages/core/src/journey-builder/types.ts:211](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/journey-builder/types.ts#L211)

## Type Parameters

| Type Parameter                                                         |
| ---------------------------------------------------------------------- |
| `TContext` _extends_ [`JourneyJsonObject`](JourneyJsonObject.md)       |
| `TStepId` _extends_ `string`                                           |
| `TEventMap` _extends_ `Record`\<`string`, `unknown`\>                  |
| `THandlers` _extends_ `Record`\<`string`, `unknown`\>                  |
| `TEventType` _extends_ `JourneyBuilderTerminalEventKey`\<`TEventMap`\> |

## Properties

### label?

```ts
optional label?: string;
```

Defined in: [packages/core/src/journey-builder/types.ts:222](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/journey-builder/types.ts#L222)

---

### onEnter?

```ts
optional onEnter?: JourneyBuilderLifecycle<TContext, TStepId, TEventMap, THandlers>;
```

Defined in: [packages/core/src/journey-builder/types.ts:220](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/journey-builder/types.ts#L220)

---

### onLeave?

```ts
optional onLeave?: JourneyBuilderLifecycle<TContext, TStepId, TEventMap, THandlers>;
```

Defined in: [packages/core/src/journey-builder/types.ts:221](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/journey-builder/types.ts#L221)

---

### timeoutMs?

```ts
optional timeoutMs?: number;
```

Defined in: [packages/core/src/journey-builder/types.ts:223](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/journey-builder/types.ts#L223)

---

### updateContext?

```ts
optional updateContext?: JourneyBuilderUpdateContext<TContext, TStepId, TEventMap, TEventType>;
```

Defined in: [packages/core/src/journey-builder/types.ts:219](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/journey-builder/types.ts#L219)

---

### when?

```ts
optional when?: JourneyBuilderGuard<TContext, TStepId, TEventMap, THandlers, TEventType>;
```

Defined in: [packages/core/src/journey-builder/types.ts:218](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/journey-builder/types.ts#L218)
