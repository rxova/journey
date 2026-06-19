[**@rxova/journey-react**](../README.md)

---

[@rxova/journey-react](../README.md) / JourneyDefinition

# Type Alias: JourneyDefinition\<TContext, TStepId, TEventMap, TStepMeta, THandlers\>

```ts
type JourneyDefinition<TContext, TStepId, TEventMap, TStepMeta, THandlers> = Omit<
  JourneyDefinitionBase<TContext, TStepId, TStepMeta, THandlers>,
  "steps"
> &
  object;
```

Defined in: [core/src/types/journey.types.ts:290](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/journey.types.ts#L290)

Full machine definition used to create a journey machine instance.

## Type Declaration

### steps

```ts
steps: Record<TStepId, JourneyStepDefinition<TContext, TStepId, TEventMap, TStepMeta, THandlers>>;
```

### transitions?

```ts
optional transitions?: JourneyTransitionsDefinition<TContext, TStepId, TEventMap, THandlers>;
```

## Type Parameters

| Type Parameter                                        | Default type                 |
| ----------------------------------------------------- | ---------------------------- |
| `TContext` _extends_ `JourneyJsonObject`              | -                            |
| `TStepId` _extends_ `string`                          | -                            |
| `TEventMap` _extends_ `Record`\<`string`, `unknown`\> | `Record`\<`never`, `never`\> |
| `TStepMeta`                                           | `unknown`                    |
| `THandlers` _extends_ `Record`\<`string`, `unknown`\> | `Record`\<`never`, `never`\> |
