[**@rxova/journey-core**](../README.md)

---

[@rxova/journey-core](../README.md) / JourneyLinearStep

# Type Alias: JourneyLinearStep\<TContext, TStepId, TEventMap, THandlers\>

```ts
type JourneyLinearStep<TContext, TStepId, TEventMap, THandlers> = JourneyTransitionBehavior<
  TContext,
  TStepId,
  TEventMap,
  THandlers,
  "goToNextStep"
> & {
  event?: never;
  from?: never;
  step: TStepId;
  to?: never;
  when?: never;
};
```

Defined in: [packages/core/src/types/transitions.types.ts:351](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/transitions.types.ts#L351)

## Type Declaration

| Name     | Type      | Defined in                                                                                                                                                                           |
| -------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `event?` | `never`   | [packages/core/src/types/transitions.types.ts:361](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/transitions.types.ts#L361) |
| `from?`  | `never`   | [packages/core/src/types/transitions.types.ts:360](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/transitions.types.ts#L360) |
| `step`   | `TStepId` | [packages/core/src/types/transitions.types.ts:357](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/transitions.types.ts#L357) |
| `to?`    | `never`   | [packages/core/src/types/transitions.types.ts:359](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/transitions.types.ts#L359) |
| `when?`  | `never`   | [packages/core/src/types/transitions.types.ts:358](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/transitions.types.ts#L358) |

## Type Parameters

| Type Parameter                                                   | Default type                 |
| ---------------------------------------------------------------- | ---------------------------- |
| `TContext` _extends_ [`JourneyJsonObject`](JourneyJsonObject.md) | -                            |
| `TStepId` _extends_ `string`                                     | -                            |
| `TEventMap` _extends_ `Record`\<`string`, `unknown`\>            | `Record`\<`never`, `never`\> |
| `THandlers` _extends_ `Record`\<`string`, `unknown`\>            | `Record`\<`never`, `never`\> |
