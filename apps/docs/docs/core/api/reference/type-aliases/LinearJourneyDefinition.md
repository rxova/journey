[**@rxova/journey-core**](../README.md)

---

[@rxova/journey-core](../README.md) / LinearJourneyDefinition

# Type Alias: LinearJourneyDefinition\<TContext, TStepId, TStepMeta, THandlers\>

```ts
type LinearJourneyDefinition<TContext, TStepId, TStepMeta, THandlers> = {
  context: TContext;
  handlers?: THandlers;
  steps: readonly [
    LinearJourneyStep<TContext, TStepId, TStepMeta, THandlers>,
    ...LinearJourneyStep<TContext, TStepId, TStepMeta, THandlers>[]
  ];
};
```

Defined in: [packages/core/src/types/journey.types.ts:236](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/journey.types.ts#L236)

Input type for `createLinearJourney`. Steps array drives both ordering and per-step config.

## Type Parameters

| Type Parameter                                                   | Default type                 |
| ---------------------------------------------------------------- | ---------------------------- |
| `TContext` _extends_ [`JourneyJsonObject`](JourneyJsonObject.md) | -                            |
| `TStepId` _extends_ `string`                                     | -                            |
| `TStepMeta`                                                      | `unknown`                    |
| `THandlers` _extends_ `Record`\<`string`, `unknown`\>            | `Record`\<`never`, `never`\> |

## Properties

### context

```ts
context: TContext;
```

Defined in: [packages/core/src/types/journey.types.ts:242](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/journey.types.ts#L242)

---

### handlers?

```ts
optional handlers?: THandlers;
```

Defined in: [packages/core/src/types/journey.types.ts:243](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/journey.types.ts#L243)

---

### steps

```ts
steps: readonly [LinearJourneyStep<TContext, TStepId, TStepMeta, THandlers>, ...LinearJourneyStep<TContext, TStepId, TStepMeta, THandlers>[]];
```

Defined in: [packages/core/src/types/journey.types.ts:244](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/journey.types.ts#L244)
