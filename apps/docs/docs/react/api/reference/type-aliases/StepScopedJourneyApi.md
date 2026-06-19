[**@rxova/journey-react**](../README.md)

---

[@rxova/journey-react](../README.md) / StepScopedJourneyApi

# Type Alias: StepScopedJourneyApi\<TContext, TStepId, TEventMap, TAllowedEventType, TStepMeta\>

```ts
type StepScopedJourneyApi<TContext, TStepId, TEventMap, TAllowedEventType, TStepMeta> = Omit<
  JourneyApi<TContext, TStepId, TEventMap, TStepMeta>,
  "send"
> &
  object;
```

Defined in: [react/src/types.ts:58](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/react/src/types.ts#L58)

## Type Declaration

### send

```ts
send: (event) => Promise<JourneySendResult<TContext, TStepId>>;
```

#### Parameters

| Parameter | Type                                                                |
| --------- | ------------------------------------------------------------------- |
| `event`   | `JourneyCustomSendEventForKeys`\<`TEventMap`, `TAllowedEventType`\> |

#### Returns

`Promise`\<[`JourneySendResult`](JourneySendResult.md)\<`TContext`, `TStepId`\>\>

## Type Parameters

| Type Parameter                                             | Default type                 |
| ---------------------------------------------------------- | ---------------------------- |
| `TContext` _extends_ `JourneyJsonObject`                   | -                            |
| `TStepId` _extends_ `string`                               | -                            |
| `TEventMap` _extends_ `Record`\<`string`, `unknown`\>      | `Record`\<`never`, `never`\> |
| `TAllowedEventType` _extends_ keyof `TEventMap` & `string` | `never`                      |
| `TStepMeta`                                                | `unknown`                    |
