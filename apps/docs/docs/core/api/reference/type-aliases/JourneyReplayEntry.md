[**@rxova/journey-core**](../README.md)

---

[@rxova/journey-core](../README.md) / JourneyReplayEntry

# Type Alias: JourneyReplayEntry\<TContext, TStepId, TEventMap\>

```ts
type JourneyReplayEntry<TContext, TStepId, TEventMap> =
  | JourneyReplaySnapshotEntry<TContext, TStepId>
  | JourneyReplayEventEntry<TStepId, TEventMap>;
```

Defined in: [packages/core/src/types/replay.types.ts:27](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/replay.types.ts#L27)

Ordered replay entry captured from a live machine session.

## Type Parameters

| Type Parameter                                                   | Default type                 |
| ---------------------------------------------------------------- | ---------------------------- |
| `TContext` _extends_ [`JourneyJsonObject`](JourneyJsonObject.md) | -                            |
| `TStepId` _extends_ `string`                                     | -                            |
| `TEventMap` _extends_ `Record`\<`string`, `unknown`\>            | `Record`\<`never`, `never`\> |
