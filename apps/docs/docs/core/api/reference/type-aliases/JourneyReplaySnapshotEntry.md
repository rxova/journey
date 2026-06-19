[**@rxova/journey-core**](../README.md)

---

[@rxova/journey-core](../README.md) / JourneyReplaySnapshotEntry

# Type Alias: JourneyReplaySnapshotEntry\<TContext, TStepId\>

```ts
type JourneyReplaySnapshotEntry<TContext, TStepId> = {
  kind: "snapshot";
  reason: JourneyMachineSnapshotReason;
  snapshot: JourneySnapshot<TContext, TStepId>;
  timestamp: number;
};
```

Defined in: [packages/core/src/types/replay.types.ts:6](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/replay.types.ts#L6)

Snapshot entry captured by the replay plugin.

## Type Parameters

| Type Parameter                                                   |
| ---------------------------------------------------------------- |
| `TContext` _extends_ [`JourneyJsonObject`](JourneyJsonObject.md) |
| `TStepId` _extends_ `string`                                     |

## Properties

### kind

```ts
kind: "snapshot";
```

Defined in: [packages/core/src/types/replay.types.ts:10](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/replay.types.ts#L10)

---

### reason

```ts
reason: JourneyMachineSnapshotReason;
```

Defined in: [packages/core/src/types/replay.types.ts:12](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/replay.types.ts#L12)

---

### snapshot

```ts
snapshot: JourneySnapshot<TContext, TStepId>;
```

Defined in: [packages/core/src/types/replay.types.ts:13](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/replay.types.ts#L13)

---

### timestamp

```ts
timestamp: number;
```

Defined in: [packages/core/src/types/replay.types.ts:11](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/replay.types.ts#L11)
