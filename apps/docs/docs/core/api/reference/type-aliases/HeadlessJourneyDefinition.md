[**@rxova/journey-core**](../README.md)

---

[@rxova/journey-core](../README.md) / HeadlessJourneyDefinition

# Type Alias: HeadlessJourneyDefinition\<TContext, TStepId, TStepMeta, THandlers\>

```ts
type HeadlessJourneyDefinition<TContext, TStepId, TStepMeta, THandlers> = {
  context: TContext;
  handlers?: THandlers;
  initial: TStepId;
  steps: Record<
    TStepId,
    JourneyStepDefinition<TContext, TStepId, Record<never, never>, TStepMeta, THandlers>
  >;
};
```

Defined in: [packages/core/src/types/journey.types.ts:251](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/journey.types.ts#L251)

Input type for `createHeadlessJourney`. `initial` is required; no `transitions` allowed.

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

Defined in: [packages/core/src/types/journey.types.ts:258](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/journey.types.ts#L258)

---

### handlers?

```ts
optional handlers?: THandlers;
```

Defined in: [packages/core/src/types/journey.types.ts:259](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/journey.types.ts#L259)

---

### initial

```ts
initial: TStepId;
```

Defined in: [packages/core/src/types/journey.types.ts:257](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/journey.types.ts#L257)

---

### steps

```ts
steps: Record<
  TStepId,
  JourneyStepDefinition<TContext, TStepId, Record<never, never>, TStepMeta, THandlers>
>;
```

Defined in: [packages/core/src/types/journey.types.ts:260](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/journey.types.ts#L260)
