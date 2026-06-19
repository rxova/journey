[**@rxova/journey-core**](../README.md)

---

[@rxova/journey-core](../README.md) / JourneyStepBuilder

# Type Alias: JourneyStepBuilder\<TContext, TStepId, TStepKey, TEventMap, TStepMeta, THandlers, THandledCustomEventType\>

```ts
type JourneyStepBuilder<
  TContext,
  TStepId,
  TStepKey,
  TEventMap,
  TStepMeta,
  THandlers,
  THandledCustomEventType
> = {
  _handledCustomEventType?: THandledCustomEventType;
  _meta: TStepMeta | undefined;
  _on:
    | Record<
        string,
        JourneyBuilderEventEntry<
          TContext,
          TStepId,
          TEventMap,
          THandlers,
          JourneyFullEventType<TEventMap>
        >
      >
    | undefined;
  _onEnter: JourneyStepLifecycleCallback<TContext, TStepId, TEventMap, THandlers> | undefined;
  _onLeave: JourneyStepLifecycleCallback<TContext, TStepId, TEventMap, THandlers> | undefined;
  id: TStepKey;
};
```

Defined in: [packages/core/src/journey-builder/types.ts:290](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/journey-builder/types.ts#L290)

## Type Parameters

| Type Parameter                                                                                                       | Default type |
| -------------------------------------------------------------------------------------------------------------------- | ------------ |
| `TContext` _extends_ [`JourneyJsonObject`](JourneyJsonObject.md)                                                     | -            |
| `TStepId` _extends_ `string`                                                                                         | -            |
| `TStepKey` _extends_ `TStepId`                                                                                       | -            |
| `TEventMap` _extends_ `Record`\<`string`, `unknown`\>                                                                | -            |
| `TStepMeta`                                                                                                          | -            |
| `THandlers` _extends_ `Record`\<`string`, `unknown`\>                                                                | -            |
| `THandledCustomEventType` _extends_ [`JourneyBuilderCustomEventKey`](JourneyBuilderCustomEventKey.md)\<`TEventMap`\> | `never`      |

## Properties

### \_handledCustomEventType?

```ts
readonly optional _handledCustomEventType?: THandledCustomEventType;
```

Defined in: [packages/core/src/journey-builder/types.ts:319](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/journey-builder/types.ts#L319)

---

### \_meta

```ts
readonly _meta: TStepMeta | undefined;
```

Defined in: [packages/core/src/journey-builder/types.ts:300](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/journey-builder/types.ts#L300)

---

### \_on

```ts
readonly _on:
  | Record<string, JourneyBuilderEventEntry<TContext, TStepId, TEventMap, THandlers, JourneyFullEventType<TEventMap>>>
  | undefined;
```

Defined in: [packages/core/src/journey-builder/types.ts:307](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/journey-builder/types.ts#L307)

---

### \_onEnter

```ts
readonly _onEnter:
  | JourneyStepLifecycleCallback<TContext, TStepId, TEventMap, THandlers>
  | undefined;
```

Defined in: [packages/core/src/journey-builder/types.ts:301](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/journey-builder/types.ts#L301)

---

### \_onLeave

```ts
readonly _onLeave:
  | JourneyStepLifecycleCallback<TContext, TStepId, TEventMap, THandlers>
  | undefined;
```

Defined in: [packages/core/src/journey-builder/types.ts:304](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/journey-builder/types.ts#L304)

---

### id

```ts
readonly id: TStepKey;
```

Defined in: [packages/core/src/journey-builder/types.ts:299](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/journey-builder/types.ts#L299)
