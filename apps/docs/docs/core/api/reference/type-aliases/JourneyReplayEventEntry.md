[**@rxova/journey-core**](../README.md)

---

[@rxova/journey-core](../README.md) / JourneyReplayEventEntry

# Type Alias: JourneyReplayEventEntry\<TStepId, TEventMap\>

```ts
type JourneyReplayEventEntry<TStepId, TEventMap> = {
  event: JourneyObservationEvent<TStepId, TEventMap>;
  kind: "event";
  timestamp: number;
};
```

Defined in: [packages/core/src/types/replay.types.ts:17](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/replay.types.ts#L17)

Observation event entry captured by the replay plugin.

## Type Parameters

| Type Parameter                                        | Default type                 |
| ----------------------------------------------------- | ---------------------------- |
| `TStepId` _extends_ `string`                          | -                            |
| `TEventMap` _extends_ `Record`\<`string`, `unknown`\> | `Record`\<`never`, `never`\> |

## Properties

### event

```ts
event: JourneyObservationEvent<TStepId, TEventMap>;
```

Defined in: [packages/core/src/types/replay.types.ts:23](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/replay.types.ts#L23)

---

### kind

```ts
kind: "event";
```

Defined in: [packages/core/src/types/replay.types.ts:21](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/replay.types.ts#L21)

---

### timestamp

```ts
timestamp: number;
```

Defined in: [packages/core/src/types/replay.types.ts:22](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/replay.types.ts#L22)
