[**@rxova/journey-core**](../README.md)

---

[@rxova/journey-core](../README.md) / JourneyAutosaveState

# Type Alias: JourneyAutosaveState

```ts
type JourneyAutosaveState = {
  error?: unknown;
  lastSavedAt?: number;
  pendingReason?: JourneyMachineSnapshotReason;
  status: JourneyAutosaveStatus;
};
```

Defined in: [packages/core/src/types/autosave.types.ts:9](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/autosave.types.ts#L9)

Runtime autosave state exposed through the autosave plugin extension.

## Properties

### error?

```ts
optional error?: unknown;
```

Defined in: [packages/core/src/types/autosave.types.ts:13](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/autosave.types.ts#L13)

---

### lastSavedAt?

```ts
optional lastSavedAt?: number;
```

Defined in: [packages/core/src/types/autosave.types.ts:11](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/autosave.types.ts#L11)

---

### pendingReason?

```ts
optional pendingReason?: JourneyMachineSnapshotReason;
```

Defined in: [packages/core/src/types/autosave.types.ts:12](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/autosave.types.ts#L12)

---

### status

```ts
status: JourneyAutosaveStatus;
```

Defined in: [packages/core/src/types/autosave.types.ts:10](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/autosave.types.ts#L10)
