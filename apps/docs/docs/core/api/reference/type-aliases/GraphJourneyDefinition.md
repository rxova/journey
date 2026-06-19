[**@rxova/journey-core**](../README.md)

---

[@rxova/journey-core](../README.md) / GraphJourneyDefinition

# Type Alias: GraphJourneyDefinition\<TContext, TStepId, TEventMap, TStepMeta, THandlers\>

```ts
type GraphJourneyDefinition<TContext, TStepId, TEventMap, TStepMeta, THandlers> = {
  context: TContext;
  handlers?: THandlers;
  initial: TStepId;
  steps: Record<TStepId, JourneyStepDefinition<TContext, TStepId, TEventMap, TStepMeta, THandlers>>;
  transitions: JourneyTransitionGraph<TContext, TStepId, TEventMap, THandlers>;
};
```

Defined in: [packages/core/src/types/transitions.types.ts:372](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/transitions.types.ts#L372)

Input type for `createGraphJourney`. `transitions` is required and must be an object map.

## Type Parameters

| Type Parameter                                                   | Default type                 |
| ---------------------------------------------------------------- | ---------------------------- |
| `TContext` _extends_ [`JourneyJsonObject`](JourneyJsonObject.md) | -                            |
| `TStepId` _extends_ `string`                                     | -                            |
| `TEventMap` _extends_ `Record`\<`string`, `unknown`\>            | `Record`\<`never`, `never`\> |
| `TStepMeta`                                                      | `unknown`                    |
| `THandlers` _extends_ `Record`\<`string`, `unknown`\>            | `Record`\<`never`, `never`\> |

## Properties

### context

```ts
context: TContext;
```

Defined in: [packages/core/src/types/transitions.types.ts:380](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/transitions.types.ts#L380)

---

### handlers?

```ts
optional handlers?: THandlers;
```

Defined in: [packages/core/src/types/transitions.types.ts:381](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/transitions.types.ts#L381)

---

### initial

```ts
initial: TStepId;
```

Defined in: [packages/core/src/types/transitions.types.ts:379](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/transitions.types.ts#L379)

---

### steps

```ts
steps: Record<TStepId, JourneyStepDefinition<TContext, TStepId, TEventMap, TStepMeta, THandlers>>;
```

Defined in: [packages/core/src/types/transitions.types.ts:382](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/transitions.types.ts#L382)

---

### transitions

```ts
transitions: JourneyTransitionGraph<TContext, TStepId, TEventMap, THandlers>;
```

Defined in: [packages/core/src/types/transitions.types.ts:383](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/transitions.types.ts#L383)
