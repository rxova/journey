[**@rxova/journey-core**](../README.md)

---

[@rxova/journey-core](../README.md) / JourneyAutosavePluginOptions

# Type Alias: JourneyAutosavePluginOptions\<TContext, TStepId\>

```ts
type JourneyAutosavePluginOptions<TContext, TStepId> = JourneyPersistenceOptions<
  TContext,
  TStepId
> & {
  debounceMs?: number;
  hydrate?: boolean;
  onSaved?: (details) => void;
  saveOn?: readonly JourneyMachineSnapshotReason[];
};
```

Defined in: [packages/core/src/types/autosave.types.ts:17](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/autosave.types.ts#L17)

Options for the autosave plugin.

## Type Declaration

| Name          | Type                                      | Defined in                                                                                                                                                                   |
| ------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `debounceMs?` | `number`                                  | [packages/core/src/types/autosave.types.ts:21](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/autosave.types.ts#L21) |
| `hydrate?`    | `boolean`                                 | [packages/core/src/types/autosave.types.ts:22](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/autosave.types.ts#L22) |
| `onSaved()?`  | (`details`) => `void`                     | [packages/core/src/types/autosave.types.ts:24](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/autosave.types.ts#L24) |
| `saveOn?`     | readonly `JourneyMachineSnapshotReason`[] | [packages/core/src/types/autosave.types.ts:23](https://github.com/rxova/journey/blob/ad9f5e971f1ca0285ff57e03cd19c8f7abfd5250/packages/core/src/types/autosave.types.ts#L23) |

## Type Parameters

| Type Parameter                                                   |
| ---------------------------------------------------------------- |
| `TContext` _extends_ [`JourneyJsonObject`](JourneyJsonObject.md) |
| `TStepId` _extends_ `string`                                     |
