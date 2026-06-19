[**@rxova/journey-core**](../README.md)

---

[@rxova/journey-core](../README.md) / LinearJourneyStep

# Type Alias: LinearJourneyStep\<TContext, TStepId, TStepMeta, THandlers\>

```ts
type LinearJourneyStep<TContext, TStepId, TStepMeta, THandlers> =
  | TStepId
  | {
      id: TStepId;
      meta?: TStepMeta;
      onEnter?: JourneyStepLifecycleCallback<TContext, TStepId, Record<never, never>, THandlers>;
      onLeave?: JourneyStepLifecycleCallback<TContext, TStepId, Record<never, never>, THandlers>;
    };
```

Defined in: [packages/core/src/types/journey.types.ts:221](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/journey.types.ts#L221)

A single entry in a linear journey's steps array — either a bare step id or a step object.

## Type Parameters

| Type Parameter                                                   | Default type                 |
| ---------------------------------------------------------------- | ---------------------------- |
| `TContext` _extends_ [`JourneyJsonObject`](JourneyJsonObject.md) | -                            |
| `TStepId` _extends_ `string`                                     | -                            |
| `TStepMeta`                                                      | `unknown`                    |
| `THandlers` _extends_ `Record`\<`string`, `unknown`\>            | `Record`\<`never`, `never`\> |
