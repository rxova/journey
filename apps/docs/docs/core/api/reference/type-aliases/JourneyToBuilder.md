[**@rxova/journey-core**](../README.md)

---

[@rxova/journey-core](../README.md) / JourneyToBuilder

# Type Alias: JourneyToBuilder\<TContext, TStepId, TEventMap, THandlers, TEventType, TUsed\>

```ts
type JourneyToBuilder<TContext, TStepId, TEventMap, THandlers, TEventType, TUsed> = {
  _candidate: JourneyBuilderCandidate<TContext, TStepId, TEventMap, THandlers, TEventType>;
  label: TUsed["label"] extends true
    ? JourneyDuplicateModifierCall<"label">
    : (label) => JourneyToBuilder<
        TContext,
        TStepId,
        TEventMap,
        THandlers,
        TEventType,
        Omit<TUsed, "label"> & {
          label: true;
        }
      >;
  onEnter: TUsed["onEnter"] extends true
    ? JourneyDuplicateModifierCall<"onEnter">
    : (fn) => JourneyToBuilder<
        TContext,
        TStepId,
        TEventMap,
        THandlers,
        TEventType,
        Omit<TUsed, "onEnter"> & {
          onEnter: true;
        }
      >;
  onLeave: TUsed["onLeave"] extends true
    ? JourneyDuplicateModifierCall<"onLeave">
    : (fn) => JourneyToBuilder<
        TContext,
        TStepId,
        TEventMap,
        THandlers,
        TEventType,
        Omit<TUsed, "onLeave"> & {
          onLeave: true;
        }
      >;
  timeoutMs: TUsed["timeoutMs"] extends true
    ? JourneyDuplicateModifierCall<"timeoutMs">
    : (ms) => JourneyToBuilder<
        TContext,
        TStepId,
        TEventMap,
        THandlers,
        TEventType,
        Omit<TUsed, "timeoutMs"> & {
          timeoutMs: true;
        }
      >;
  updateContext: TUsed["updateContext"] extends true
    ? JourneyDuplicateModifierCall<"updateContext">
    : (fn) => JourneyToBuilder<
        TContext,
        TStepId,
        TEventMap,
        THandlers,
        TEventType,
        Omit<TUsed, "updateContext"> & {
          updateContext: true;
        }
      >;
  when: TUsed["when"] extends true
    ? JourneyDuplicateModifierCall<"when">
    : (guard) => JourneyToBuilder<
        TContext,
        TStepId,
        TEventMap,
        THandlers,
        TEventType,
        Omit<TUsed, "when"> & {
          when: true;
        }
      >;
};
```

Defined in: [packages/core/src/journey-builder/types.ts:98](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/journey-builder/types.ts#L98)

## Type Parameters

| Type Parameter                                                                          | Default type                                                     |
| --------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `TContext` _extends_ [`JourneyJsonObject`](JourneyJsonObject.md)                        | -                                                                |
| `TStepId` _extends_ `string`                                                            | -                                                                |
| `TEventMap` _extends_ `Record`\<`string`, `unknown`\>                                   | -                                                                |
| `THandlers` _extends_ `Record`\<`string`, `unknown`\>                                   | -                                                                |
| `TEventType` _extends_ [`JourneyFullEventType`](JourneyFullEventType.md)\<`TEventMap`\> | [`JourneyFullEventType`](JourneyFullEventType.md)\<`TEventMap`\> |
| `TUsed` _extends_ `JourneyToBuilderUsage`                                               | `JourneyToBuilderUnused`                                         |

## Properties

### \_candidate

```ts
readonly _candidate: JourneyBuilderCandidate<TContext, TStepId, TEventMap, THandlers, TEventType>;
```

Defined in: [packages/core/src/journey-builder/types.ts:106](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/journey-builder/types.ts#L106)

---

### label

```ts
label: TUsed["label"] extends true ? JourneyDuplicateModifierCall<"label"> : (label) => JourneyToBuilder<TContext, TStepId, TEventMap, THandlers, TEventType, Omit<TUsed, "label"> & {
  label: true;
}>;
```

Defined in: [packages/core/src/journey-builder/types.ts:155](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/journey-builder/types.ts#L155)

---

### onEnter

```ts
onEnter: TUsed["onEnter"] extends true ? JourneyDuplicateModifierCall<"onEnter"> : (fn) => JourneyToBuilder<TContext, TStepId, TEventMap, THandlers, TEventType, Omit<TUsed, "onEnter"> & {
  onEnter: true;
}>;
```

Defined in: [packages/core/src/journey-builder/types.ts:131](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/journey-builder/types.ts#L131)

---

### onLeave

```ts
onLeave: TUsed["onLeave"] extends true ? JourneyDuplicateModifierCall<"onLeave"> : (fn) => JourneyToBuilder<TContext, TStepId, TEventMap, THandlers, TEventType, Omit<TUsed, "onLeave"> & {
  onLeave: true;
}>;
```

Defined in: [packages/core/src/journey-builder/types.ts:143](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/journey-builder/types.ts#L143)

---

### timeoutMs

```ts
timeoutMs: TUsed["timeoutMs"] extends true ? JourneyDuplicateModifierCall<"timeoutMs"> : (ms) => JourneyToBuilder<TContext, TStepId, TEventMap, THandlers, TEventType, Omit<TUsed, "timeoutMs"> & {
  timeoutMs: true;
}>;
```

Defined in: [packages/core/src/journey-builder/types.ts:167](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/journey-builder/types.ts#L167)

---

### updateContext

```ts
updateContext: TUsed["updateContext"] extends true ? JourneyDuplicateModifierCall<"updateContext"> : (fn) => JourneyToBuilder<TContext, TStepId, TEventMap, THandlers, TEventType, Omit<TUsed, "updateContext"> & {
  updateContext: true;
}>;
```

Defined in: [packages/core/src/journey-builder/types.ts:119](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/journey-builder/types.ts#L119)

---

### when

```ts
when: TUsed["when"] extends true ? JourneyDuplicateModifierCall<"when"> : (guard) => JourneyToBuilder<TContext, TStepId, TEventMap, THandlers, TEventType, Omit<TUsed, "when"> & {
  when: true;
}>;
```

Defined in: [packages/core/src/journey-builder/types.ts:107](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/journey-builder/types.ts#L107)
